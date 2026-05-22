# Collection Management
Hoppscotch's Collection Management system provides a hierarchical, tree-based organization for API requests (both REST and GraphQL). Collections can be personal (User Collections) or shared within a Team (Team Collections), supporting nesting, sorting, import/export, duplication, and real-time collaboration.

## Overview
Collections serve as the primary organizational unit in Hoppscotch, allowing users to group related API requests, set shared configuration (such as authentication headers or scripts at the collection level), and establish meaningful folder structures. The system supports two distinct collection scopes:

- **User Collections** — Private collections owned by an individual user, scoped to REST or GraphQL request types.
- **Team Collections** — Shared collections that belong to a team workspace, accessible by team members based on their role (Viewer, Editor, Owner).

Both collection types share the same fundamental architecture: a self-referencing tree structure where each collection can be a root-level item or a child of another collection (i.e., a folder). Collections contain requests as leaf nodes and can have nested child collections of arbitrary depth.

### Key Concepts

- **Hierarchical Tree Structure**: Collections form a parent-child tree. A root collection has `parentID = null`, while child collections reference their parent's ID.
- **Ordered Siblings**: Collections at the same level (same `parentID`) are ordered using an `orderIndex` integer field, enabling drag-and-drop reordering.
- **Self-Referencing Relationship**: Both `TeamCollection` and `UserCollection` use Prisma's self-referential `@relation` to model parent-child nesting.
- **Unique Constraints**: Each collection type enforces uniqueness on `[teamID/userUid, parentID, orderIndex]` to prevent ordering conflicts.
- **Real-Time Subscriptions**: Collection mutations (create, update, delete, move, reorder, duplicate) publish events via PubSub for real-time UI updates.

## Architecture
### System Architecture
The Collection Management system employs a layered architecture spanning the backend (NestJS + Prisma + PostgreSQL) and frontend (Vue.js + Apollo GraphQL).

加载图表中...
### Data Model
Both `TeamCollection` and `UserCollection` models follow an almost identical self-referencing tree schema:

加载图表中...
>
Sources:

- [Prisma Schema - TeamCollection](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma#L42-L57)
- [Prisma Schema - UserCollection](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma#L197-L212)

**Key design differences between TeamCollection and UserCollection:**

FeatureTeamCollectionUserCollectionOwnershipBelongs to a TeamBelongs to a single UserRequest TypeBoth REST & GQL mixedSegregated by `type` (REST vs GQL)AuthorizationRole-based (Viewer/Editor/Owner)User ownership (JWT)Unique Constraint`[teamID, parentID, orderIndex]``[userUid, parentID, orderIndex]`
## Core Features
### 1. Collection CRUD Operations
The service layer exposes comprehensive CRUD operations for both collection types. All operations use **Either-based error handling** from the `fp-ts` library, returning either a successful result (`E.Right`) or an error string (`E.Left`).

#### Creating Collections
Collections can be created at the root level or as children of an existing collection (creating a folder/nested structure).

**Root Collection Creation:**
When a root collection is created (no parent), the system:

- Validates the title length (minimum 1 character).
- Acquires a database row lock on the team/user's parent scope to prevent race conditions.
- Fetches the last collection's `orderIndex` under the same parent.
- Creates the new collection with `orderIndex = lastIndex + 1`.

typescript1// From TeamCollectionService.createCollection()
2async createCollection(
3  teamID: string,
4  title: string,
5  data: string | null = null,
6  parentID: string | null,
7) {
8  const isTitleValid = isValidLength(title, this.TITLE_LENGTH);
9  if (!isTitleValid) return E.left(TEAM_COLL_SHORT_TITLE);
10
11  if (parentID !== null) {
12    const isOwner = await this.isOwnerCheck(parentID, teamID);
13    if (O.isNone(isOwner)) return E.left(TEAM_NOT_OWNER);
14  }
15
16  // ... data validation ...
17
18  teamCollection = await this.prisma.$transaction(async (tx) => {
19    await this.prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID);
20
21    const lastCollection = await tx.teamCollection.findFirst({
22      where: { teamID, parentID },
23      orderBy: { orderIndex: 'desc' },
24      select: { orderIndex: true },
25    });
26
27    return tx.teamCollection.create({
28      data: {
29        title,
30        teamID,
31        parentID: parentID ? parentID : undefined,
32        data: data ?? undefined,
33        orderIndex: lastCollection ? lastCollection.orderIndex + 1 : 1,
34      },
35    });
36  });
37
38  // Publish real-time notification
39  this.pubsub.publish(`team_coll/${teamID}/coll_added`, this.cast(teamCollection));
40  return E.right(this.cast(teamCollection));
41}
>
Source: [TeamCollectionService - createCollection](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts#L452-L517)

The corresponding GraphQL GraphQL mutations from the frontend:

graphql1# Create a new root collection under a team
2mutation CreateNewRootCollection($title: String!, $teamID: ID!) {
3  createRootCollection(title: $title, teamID: $teamID) {
4    id
5  }
6}
7
8# Create a child collection (folder) under an existing collection
9mutation CreateChildCollection($childTitle: String!, $collectionID: ID!) {
10  createChildCollection(childTitle: $childTitle, collectionID: $collectionID) {
11    id
12  }
13}
>
Sources:

- [CreateNewRootCollection.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/mutations/CreateNewRootCollection.graphql)
- [CreateChildCollection.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/mutations/CreateChildCollection.graphql)

#### Renaming Collections
Collections can be renamed (now superseded by the more general `updateTeamCollection` mutation):

graphql1mutation RenameCollection($newTitle: String!, $collectionID: ID!) {
2  renameCollection(newTitle: $newTitle, collectionID: $collectionID) {
3    id
4  }
5}
>
Source: [RenameCollection.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/mutations/RenameCollection.graphql)

#### Deleting Collections
When a collection is deleted, the service performs a robust operation:

- Fetches the collection to confirm it exists.
- Within a database transaction with row locking:

Deletes the collection record.
- Decrements `orderIndex` of all subsequent sibling collections to close the gap.

- Implements retry logic (up to 5 attempts) for concurrent deletion conflicts.
- The database's `ON DELETE CASCADE` ensures all child collections, requests, and references are automatically removed.

typescript1// From TeamCollectionService
2async deleteCollection(collectionID: string) {
3  const collection = await this.getCollection(collectionID);
4  if (E.isLeft(collection)) return E.left(collection.left);
5
6  const isDeleted = await this.deleteCollectionAndUpdateSiblingsOrderIndex(
7    collection.right,
8    { gt: collection.right.orderIndex },
9    { decrement: 1 },
10  );
11  if (E.isLeft(isDeleted)) return E.left(isDeleted.left);
12
13  this.pubsub.publish(
14    `team_coll/${collection.right.teamID}/coll_removed`,
15    collection.right.id,
16  );
17  return E.right(true);
18}
>
Source: [TeamCollectionService - deleteCollection](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts#L624-L642)

graphqlmutation DeleteCollection($collectionID: ID!) {
  deleteCollection(collectionID: $collectionID)
}
>
Source: [DeleteCollection.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/mutations/DeleteCollection.graphql)

### 2. Moving Collections (Reparenting)
Collections can be moved to a different parent or promoted/demoted between root and child levels. The move operation performs several safety checks:

- **Self-move guard**: Prevents moving a collection into itself.
- **Same-team validation**: Both source and destination must belong to the same team.
- **Circular dependency check**: Uses a recursive `isParent()` method to ensure the collection being moved is not an ancestor of the destination (which would create an invalid tree).
- **Deterministic lock ordering**: To prevent deadlocks in concurrent moves, locks are acquired in sorted order by `parentID`.
- **Order index management**: Sibling `orderIndex` values are adjusted at both the source and destination parent scopes.

加载图表中...
### 3. Reordering Collections
Collections support fine-grained positional ordering via the `updateCollectionOrder` mutation. The operation can move a collection to:

- **End of the list**: When `destCollID` is `null`, the collection is moved to the last position.
- **Before a specific sibling**: When `destCollID` points to a sibling, the collection is inserted before that sibling.

The algorithm intelligently handles moving up vs. moving down by computing the range of affected siblings and shifting their `orderIndex` values accordingly:

typescript1// From TeamCollectionService.updateCollectionOrder()
2// Determine if we are moving collection up or down the list
3const isMovingUp =
4  subsequentCollectionInTx.orderIndex < collectionInTx.orderIndex;
5
6// Calculate the range of siblings to shift
7const updateFrom = isMovingUp
8  ? subsequentCollectionInTx.orderIndex
9  : collectionInTx.orderIndex + 1;
10
11const updateTo = isMovingUp
12  ? collectionInTx.orderIndex - 1
13  : subsequentCollectionInTx.orderIndex - 1;
14
15// Shift siblings in the range
16await tx.teamCollection.updateMany({
17  where: {
18    teamID: collection.right.teamID,
19    parentID: collection.right.parentID,
20    orderIndex: { gte: updateFrom, lte: updateTo },
21  },
22  data: {
23    orderIndex: isMovingUp ? { increment: 1 } : { decrement: 1 },
24  },
25});
26
27// Update the collection's own position
28await tx.teamCollection.update({
29  where: { id: collection.right.id },
30  data: {
31    orderIndex: isMovingUp
32      ? subsequentCollectionInTx.orderIndex
33      : subsequentCollectionInTx.orderIndex - 1,
34  },
35});
>
Source: [TeamCollectionService - updateCollectionOrder](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts#L1000-L1033)

graphqlmutation UpdateCollectionOrder($collectionID: ID!, $destCollID: ID) {
  updateCollectionOrder(collectionID: $collectionID, destCollID: $destCollID)
}
>
Source: [UpdateCollectionOrder.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/mutations/UpdateCollectionOrder.graphql)

### 4. Sorting Collections
The system provides alphabetical sorting options for collections within a parent scope. The `SortService` applies a database transaction with row locking, then reassigns sequential `orderIndex` values:

typescript1// Sort options available
2export enum SortOptions {
3  TITLE_ASC = 'TITLE_ASC',
4  TITLE_DESC = 'TITLE_DESC',
5}
6
7// Sorting implementation (TeamCollection example)
8async sortTeamCollections(teamID: string, parentID: string, sortBy: SortOptions) {
9  let orderBy;
10  if (sortBy === SortOptions.TITLE_ASC) orderBy = { title: 'asc' };
11  else if (sortBy === SortOptions.TITLE_DESC) orderBy = { title: 'desc' };
12  else orderBy = { orderIndex: 'asc' };
13
14  await this.prisma.$transaction(async (tx) => {
15    await this.prisma.lockTeamCollectionByTeamAndParent(tx, teamID, parentID);
16
17    const collections = await tx.teamCollection.findMany({
18      where: { teamID, parentID },
19      orderBy,
20      select: { id: true },
21    });
22
23    // Reassign orderIndex based on sorted order
24    await Promise.all(
25      collections.map((collection, i) =>
26        tx.teamCollection.update({
27          where: { id: collection.id },
28          data: { orderIndex: i + 1 },
29        }),
30      ),
31    );
32  });
33
34  return E.right(true);
35}
>
Source: [TeamCollectionService - sortTeamCollections](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts#L1533-L1580)

### 5. Import/Export
Collections can be exported to and imported from JSON, supporting the **Hoppscotch Collection Format** defined by the `CollectionFolder` type:

typescript1// The CollectionFolder structure used for import/export
2export class CollectionFolder {
3  id?: string;                 // Optional unique identifier
4  folders: CollectionFolder[]; // Nested sub-collections
5  requests: any[];             // Requests in this collection
6  name: string;                // Collection name
7  data?: string;               // Additional data (headers, auth, scripts)
8}
>
Source: [CollectionFolder.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/types/CollectionFolder.ts)

The import process:

- **Validates** the JSON string as a proper array of `CollectionFolder` objects.
- **Acquires a row lock** on the target parent scope to prevent concurrent conflicts.
- **Generates recursive Prisma create queries** via `generatePrismaQueryObjForFBCollFolder()` that build the entire tree in a single database operation.
- **Publishes creation events** for each imported collection so the UI updates in real-time.

The export process recursively traverses the entire tree, building nested `CollectionFolder` objects:

typescript1// Recursive export - builds the full tree structure
2async exportCollectionToJSONObject(teamID: string, collectionID: string) {
3  const collection = await this.getCollection(collectionID);
4
5  // Recursively export children
6  const childrenCollectionObjects = [];
7  const childrenCollection = await this.prisma.teamCollection.findMany({
8    where: { teamID, parentID: collectionID },
9    orderBy: { orderIndex: 'asc' },
10  });
11
12  for (const coll of childrenCollection) {
13    const result = await this.exportCollectionToJSONObject(teamID, coll.id);
14    childrenCollectionObjects.push(result.right);
15  }
16
17  // Fetch all requests in this collection
18  const requests = await this.prisma.teamRequest.findMany({
19    where: { teamID, collectionID },
20    orderBy: { orderIndex: 'asc' },
21  });
22
23  return E.right({
24    id: collection.right.id,
25    name: collection.right.title,
26    folders: childrenCollectionObjects,
27    requests: requests.map((x) => ({
28      ...(typeof x.request === 'string' ? JSON.parse(x.request) : x.request),
29      id: x.id,
30    })),
31    data: transformCollectionData(collection.right.data),
32  });
33}
>
Source: [TeamCollectionService - exportCollectionToJSONObject](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts#L111-L165)

### 6. Duplication
Collections can be duplicated (including all nested children and requests). The duplication process:

- **Exports** the collection to its JSON representation.
- **Appends " - Duplicate"** to the collection name.
- **Imports** the JSON back into the same parent scope.

### 7. Search
The system provides full-text search across collections and requests within a team using PostgreSQL's `ILIKE` and `pg_trgm` similarity operators:

typescript1// Raw SQL query for collection search with title similarity ordering
2const query = Prisma.sql`
3  SELECT id, title, 'collection' AS type
4  FROM "TeamCollection"
5  WHERE "TeamCollection"."teamID"=${teamID}
6    AND title ILIKE ${`%${escapeSqlLikeString(searchQuery)}%`}
7  ORDER BY similarity(title, ${searchQuery})
8  LIMIT ${take}
9  OFFSET ${skip};
10`;
>
Source: [TeamCollectionService - searchCollections](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts#L1201-L1228)

Search results include a **parent tree path** generated using recursive PostgreSQL CTEs (`WITH RECURSIVE`) that traces each match back to its root collection, enabling the UI to display breadcrumb navigation.

### 8. Real-Time Subscriptions
All collection mutations publish events via a `PubSubService` that the GraphQL subscriptions layer listens to. This enables real-time collaboration features:

EventChannel PatternEmitted ValueCollection Added`team_coll/${teamID}/coll_added``TeamCollection`Collection Updated`team_coll/${teamID}/coll_updated``TeamCollection`Collection Removed`team_coll/${teamID}/coll_removed``ID`Collection Moved`team_coll/${teamID}/coll_moved``TeamCollection`Order Updated`team_coll/${teamID}/coll_order_updated``CollectionReorderData`
The User Collection subscriptions follow the same pattern with `user_coll/${uid}/...` channels.

## Configuration Options
### Collection Validation Constants
OptionValueDescriptionService`TITLE_LENGTH``1`Minimum title length requirementBoth`MAX_RETRIES``5`Maximum retry attempts for concurrent DB transactionsBoth
### Error Codes
Error CodeDescriptionService`team_coll/collection_not_found`Collection ID does not existTeam`team_coll/short_title`Title is less than 1 characterTeam`team_coll/invalid_json`Import JSON is malformedTeam`team_coll/collection_is_parent_coll`Cannot move into own childTeam`team_coll/collections_not_same_team`Source and destination belong to different teamsTeam`user_coll/not_found`Collection ID does not existUser`user_coll/type_mismatch`REST/GQL type mismatch when moving or creatingUser`user_coll/not_same_user`Source and destination belong to different usersUser
## API Reference
### Team Collection GraphQL Resolver
The `TeamCollectionResolver` (guarded by `GqlAuthGuard`, `GqlTeamMemberGuard`, and `GqlCollectionTeamMemberGuard`) exposes the following operations:

MethodTypeDescriptionRequired Role`createRootCollection(teamID, title, data?)`MutationCreates a root-level collectionEDITOR, OWNER`createChildCollection(collectionID, childTitle, data?)`MutationCreates a child collection under a parentEDITOR, OWNER`deleteCollection(collectionID)`MutationDeletes a collection (cascading)EDITOR, OWNER`renameCollection(collectionID, newTitle)`Mutation(Deprecated) Use `updateTeamCollection` insteadEDITOR, OWNER`updateTeamCollection(collectionID, data?, newTitle?)`MutationUpdates collection title and/or dataEDITOR, OWNER`moveCollection(collectionID, parentCollectionID?)`MutationMoves collection to new parent or rootEDITOR, OWNER`updateCollectionOrder(collectionID, destCollID?)`MutationReorders collection within its siblingsEDITOR, OWNER`duplicateTeamCollection(collectionID)`MutationDuplicates a collection and its contentsEDITOR, OWNER`importCollectionsFromJSON(teamID, jsonString, parentCollectionID?)`MutationImports collections from JSONEDITOR, OWNER`rootCollectionsOfTeam(teamID, cursor?, take?)`QueryGets root collections with cursor paginationVIEWER+`collection(collectionID)`QueryGets a single collection by IDVIEWER+`exportCollectionsToJSON(teamID)`QueryExports all team collections to JSONVIEWER+`exportCollectionToJSON(teamID, collectionID)`QueryExports a single collection to JSONVIEWER+`teamCollectionAdded(teamID)`SubscriptionReal-time: collection createdVIEWER+`teamCollectionUpdated(teamID)`SubscriptionReal-time: collection updatedVIEWER+`teamCollectionRemoved(teamID)`SubscriptionReal-time: collection deletedVIEWER+`teamCollectionMoved(teamID)`SubscriptionReal-time: collection movedVIEWER+`collectionOrderUpdated(teamID)`SubscriptionReal-time: order changedVIEWER+
>
Source: [TeamCollectionResolver](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.resolver.ts)

### User Collection GraphQL Resolver
The `UserCollectionResolver` (guarded by `GqlAuthGuard`) mirrors most team operations with type-specific variants:

MethodTypeDescription`createRESTRootUserCollection(title, data?)`MutationCreates root REST collection`createGQLRootUserCollection(title, data?)`MutationCreates root GraphQL collection`createRESTChildUserCollection(parentUserCollectionID, title, data?)`MutationCreates child REST collection`createGQLChildUserCollection(parentUserCollectionID, title, data?)`MutationCreates child GraphQL collection`deleteUserCollection(userCollectionID)`MutationDeletes a user collection`renameUserCollection(newTitle, userCollectionID)`MutationRenames a user collection`updateUserCollection(newTitle?, data?, userCollectionID)`MutationUpdates collection details`moveUserCollection(userCollectionID, destCollectionID?)`MutationMoves user collection`updateUserCollectionOrder(collectionID, nextCollectionID?)`MutationReorders user collections`duplicateUserCollection(collectionID, reqType)`MutationDuplicates a user collection`importUserCollectionsFromJSON(jsonString, parentCollectionID?, reqType)`MutationImports from JSON`rootRESTUserCollections(cursor?, take?)`QueryGets root REST collections`rootGQLUserCollections(cursor?, take?)`QueryGets root GraphQL collections`userCollection(userCollectionID)`QueryGets collection by ID`exportUserCollectionsToJSON(collectionID?, collectionType)`QueryExports to JSON`exportUserCollectionToJSON(collectionID)`QueryExports single collection to JSON`userCollectionCreated()`SubscriptionReal-time: created`userCollectionUpdated()`SubscriptionReal-time: updated`userCollectionRemoved()`SubscriptionReal-time: deleted`userCollectionMoved()`SubscriptionReal-time: moved`userCollectionOrderUpdated()`SubscriptionReal-time: order updated`userCollectionDuplicated()`SubscriptionReal-time: duplicated
>
Source: [UserCollectionResolver](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-collection/user-collection.resolver.ts)

### REST Endpoints
MethodEndpointDescriptionAuth`GET``/v1/team-collection/search/:teamID?searchQuery=&take=&skip=`Search collections and requests by titleJWT + Team Member
>
Source: [TeamCollectionController](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.controller.ts)

## Related Links

- [Team Collection Service Implementation](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.service.ts)
- [Team Collection Resolver](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.resolver.ts)
- [Team Collection Data Model](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-collection/team-collection.model.ts)
- [User Collection Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-collection/user-collection.service.ts)
- [User Collection Resolver](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-collection/user-collection.resolver.ts)
- [Collection Folder Type](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/types/CollectionFolder.ts)
- [Collection Search Node Type](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/types/CollectionSearchNode.ts)
- [Frontend Collection Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/collections/Collection.vue)
- [Prisma Schema](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma)
- [GraphQL Mutations - Collections](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/mutations/)
- [Environments Management](./7-collections-and-environments.2-environment-management)