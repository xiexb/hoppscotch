# Admin Dashboard Overview
The Admin Dashboard is a self-hosted administrative web interface for managing a Hoppscotch instance. It provides server administrators with tools to monitor infrastructure metrics, manage users and teams, configure authentication providers and SMTP settings, and control various server-wide configurations.

## Overview
The Admin Dashboard is built as a standalone web application (`hoppscotch-sh-admin`) that communicates with the Hoppscotch backend via GraphQL APIs and REST endpoints. It is designed for self-hosted Hoppscotch instances and provides a centralized interface for instance administration.

**Key responsibilities of the Admin Dashboard include:**

- **Infrastructure Monitoring** — Display key metrics about the instance, including total users, teams, collections, and requests.
- **User Management** — Invite new users, view user details, promote/demote admin roles, update display names, and remove user accounts.
- **Team Management** — Create, rename, and delete teams; manage team memberships and roles; view team details.
- **Authentication Configuration** — Configure OAuth providers (Google, GitHub, Microsoft), email-based authentication, and token settings.
- **SMTP Configuration** — Set up and manage email delivery for user invitations and magic link authentication.
- **Infrastructure Configuration** — Manage rate limiting, session secrets, JWT settings, mock server domains, analytics collection, and user history storage.
- **Token Management** — Create and revoke infrastructure tokens for API access.

## Architecture
The Admin Dashboard follows a client-server architecture where the frontend Vue.js application communicates with the NestJS backend through GraphQL and REST APIs.

加载图表中...
### Architecture Explanation
**Frontend Layer:**

- The dashboard is built with **Vue 3** using Composition API (`<script setup>`)
- **Vue Router** with file-based routing (via `vite-plugin-pages`) handles navigation between sections
- **urql** (`@urql/vue`) is used as the GraphQL client for executing admin queries and mutations
- **Axios** handles REST API calls for authentication flows
- The application is served via **Caddy** web server in production (Docker-based deployment)

**Backend Layer:**

- The Admin Dashboard requires the **Hoppscotch Backend** (NestJS) to be running
- All admin-protected GraphQL queries and mutations are guarded by `GqlAdminGuard` and `GqlAuthGuard`, ensuring only authenticated admin users have access
- REST endpoints for authentication (magic link, OAuth) use `RESTAdminGuard` for admin-specific routes
- **Prisma ORM** connects to a PostgreSQL database that stores all user, team, and configuration data

## Core Flow
### Dashboard Data Flow
The dashboard page fetches key infrastructure metrics via a single GraphQL query and displays them using metrics cards.

加载图表中...
### Admin Authentication Flow
Access to the admin dashboard requires admin-level authentication. The route guards enforce this flow:

加载图表中...
### Admin Service Operations Flow
The backend `AdminService` provides a comprehensive set of operations for infrastructure management:

加载图表中...
## Usage Examples
### Dashboard Metrics Data Fetching
The dashboard page fetches infrastructure metrics from the backend using a GraphQL query with the `@urql/vue` `useQuery` composable:

vue1<template>
2  <div v-if="fetching" class="flex justify-center py-6">
3    <HoppSmartSpinner />
4  </div>
5
6  <div v-else-if="error || !metrics">
7    <p class="text-xl">{{ t('metrics.no_metrics') }}</p>
8  </div>
9
10  <div v-else>
11    <div class="py-10 grid lg:grid-cols-2 gap-6">
12      <DashboardMetricsCard
13        :count="metrics.usersCount"
14        :label="t('metrics.total_users')"
15        :icon="UserIcon"
16        color="text-green-400"
17      />
18      <DashboardMetricsCard
19        :count="metrics.teamsCount"
20        :label="t('metrics.total_teams')"
21        :icon="UsersIcon"
22        color="text-pink-400"
23      />
24      <DashboardMetricsCard
25        :count="metrics.teamRequestsCount"
26        :label="t('metrics.total_requests')"
27        :icon="LineChartIcon"
28        color="text-cyan-400"
29      />
30      <DashboardMetricsCard
31        :count="metrics.teamCollectionsCount"
32        :label="t('metrics.total_collections')"
33        :icon="FolderTreeIcon"
34        color="text-orange-400"
35      />
36    </div>
37  </div>
38</template>
39
40<script setup lang="ts">
41import { computed } from 'vue';
42import { useQuery } from '@urql/vue';
43import { MetricsDocument } from '../helpers/backend/graphql';
44import UserIcon from '~icons/lucide/user';
45import UsersIcon from '~icons/lucide/users';
46import LineChartIcon from '~icons/lucide/line-chart';
47import FolderTreeIcon from '~icons/lucide/folder-tree';
48import { useI18n } from '../composables/i18n';
49
50const t = useI18n();
51
52// Get Metrics Data
53const { fetching, error, data } = useQuery({
54  query: MetricsDocument,
55  variables: {},
56});
57const metrics = computed(() => data?.value?.infra);
58</script>
>
Source: [dashboard.vue](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/pages/dashboard.vue#L1-L63)

### Metrics GraphQL Query
The underlying GraphQL query that retrieves dashboard metrics:

graphql1query Metrics {
2  infra {
3    usersCount
4    teamsCount
5    teamRequestsCount
6    teamCollectionsCount
7  }
8}
>
Source: [Metrics.graphql](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/helpers/backend/gql/queries/Metrics.graphql#L1-L8)

### Metrics Card Component
The reusable metrics card displays a single metric with an icon, count, and label:

vue1<template>
2  <div
3    class="flex items-center sm:px-16 px-8 justify-start py-6 bg-primaryLight rounded-md shadow-sm h-48 space-x-6"
4  >
5    <component :is="icon" class="text-5xl" :class="color" />
6    <div class="space-y-2">
7      <h4 class="text-4xl font-semibold text-accentContrast">
8        {{ count }}
9      </h4>
10      <div class="text-gray-400 font-bold">
11        {{ label }}
12      </div>
13    </div>
14  </div>
15</template>
16
17<script lang="ts" setup>
18import type { Component } from 'vue';
19
20defineProps<{
21  count: number;
22  label: string;
23  icon: Component;
24  color: string;
25}>();
26</script>
>
Source: [MetricsCard.vue](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/components/dashboard/MetricsCard.vue#L1-L27)

### Admin Route Guard (Backend)
The `GqlAdminGuard` ensures only admin users can access admin GraphQL resolvers:

typescript1import { Injectable, ExecutionContext, CanActivate } from '@nestjs/common';
2import { GqlExecutionContext } from '@nestjs/graphql';
3
4@Injectable()
5export class GqlAdminGuard implements CanActivate {
6  canActivate(context: ExecutionContext): boolean {
7    const ctx = GqlExecutionContext.create(context);
8    const { req, headers } = ctx.getContext();
9    const request = headers ? headers : req;
10    const user = request.user;
11    if (user.isAdmin) return true;
12    else return false;
13  }
14}
>
Source: [gql-admin.guard.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/guards/gql-admin.guard.ts#L1-L13)

### Inviting a New User (Admin Service)
The `AdminService.inviteUserToSignInViaEmail` method handles user invitations:

typescript1async inviteUserToSignInViaEmail(
2  adminUID: string,
3  adminEmail: string,
4  inviteeEmail: string,
5) {
6  if (inviteeEmail.toLowerCase() == adminEmail.toLowerCase()) {
7    return E.left(DUPLICATE_EMAIL);
8  }
9  if (!validateEmail(inviteeEmail)) return E.left(INVALID_EMAIL);
10
11  const alreadyInvitedUser = await this.prisma.invitedUsers.findFirst({
12    where: {
13      inviteeEmail: {
14        equals: inviteeEmail,
15        mode: 'insensitive',
16      },
17    },
18  });
19  if (alreadyInvitedUser != null) return E.left(USER_ALREADY_INVITED);
20
21  try {
22    await this.mailerService.sendUserInvitationEmail(inviteeEmail, {
23      template: 'user-invitation',
24      variables: {
25        inviteeEmail: inviteeEmail,
26        magicLink: `${this.configService.get('VITE_BASE_URL')}`,
27      },
28    });
29  } catch (e) {
30    return E.left(EMAIL_FAILED);
31  }
32
33  // Add invitee email to the list of invited users by admin
34  const dbInvitedUser = await this.prisma.invitedUsers.create({
35    data: {
36      adminUid: adminUID,
37      adminEmail: adminEmail,
38      inviteeEmail: inviteeEmail,
39    },
40  });
41
42  // Publish invited user subscription
43  await this.pubsub.publish(`admin/${adminUID}/invited`, dbInvitedUser);
44
45  return E.right(dbInvitedUser);
46}
>
Source: [admin.service.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.service.ts#L88-L140)

### Sidebar Navigation Configuration
The sidebar defines the primary navigation structure of the admin dashboard:

typescript1const primaryNavigations: NavigationItem[] = [
2  {
3    label: t('metrics.dashboard'),
4    icon: IconDashboard,
5    to: '/dashboard',
6    exact: true,
7    baseRouteName: 'dashboard',
8  },
9  {
10    label: t('users.users'),
11    icon: IconUser,
12    to: '/users',
13    exact: false,
14    baseRouteName: 'users'
15  },
16  {
17    label: t('teams.teams'),
18    icon: IconUsers,
19    to: '/teams',
20    exact: false,
21    baseRouteName: 'teams'
22  },
23  {
24    label: t('settings.settings'),
25    icon: IconSettings,
26    to: '/settings',
27    exact: true,
28    baseRouteName: 'settings',
29  },
30];
>
Source: [Sidebar.vue](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/components/app/Sidebar.vue#L97-L126)

## Infrastructure Configuration Options
The Admin Dashboard allows administrators to configure various infrastructure settings through the Settings page. These configurations are stored in the database using the `InfraConfigService` and can be updated via GraphQL mutations.

Configuration CategoryConfiguration KeyDescription**Authentication**`ALLOWED_AUTH_PROVIDERS`List of enabled authentication providers (Google, GitHub, Microsoft, Email)**Google OAuth**`GOOGLE_CLIENT_ID`Google OAuth client ID`GOOGLE_CLIENT_SECRET`Google OAuth client secret`GOOGLE_CALLBACK_URL`Google OAuth callback URL`GOOGLE_SCOPE`Google OAuth scope**GitHub OAuth**`GITHUB_CLIENT_ID`GitHub OAuth client ID`GITHUB_CLIENT_SECRET`GitHub OAuth client secret`GITHUB_CALLBACK_URL`GitHub OAuth callback URL`GITHUB_SCOPE`GitHub OAuth scope**Microsoft OAuth**`MICROSOFT_CLIENT_ID`Microsoft OAuth client ID`MICROSOFT_CLIENT_SECRET`Microsoft OAuth client secret`MICROSOFT_CALLBACK_URL`Microsoft OAuth callback URL`MICROSOFT_SCOPE`Microsoft OAuth scope`MICROSOFT_TENANT`Microsoft OAuth tenant**SMTP**`MAILER_SMTP_URL`SMTP server URL`MAILER_FROM_ADDRESS`Default sender email address`MAILER_SMTP_ENABLED`Whether SMTP is enabled`MAILER_USE_CUSTOM_CONFIGS`Whether to use custom SMTP configs`MAILER_SMTP_HOST`SMTP host (for custom configs)`MAILER_SMTP_PORT`SMTP port`MAILER_SMTP_USER`SMTP username`MAILER_SMTP_PASSWORD`SMTP password`MAILER_SMTP_SECURE`Whether to use secure SMTP`MAILER_SMTP_IGNORE_TLS`Ignore TLS certificate validation**Token Settings**`JWT_SECRET`JWT signing secret`SESSION_SECRET`Session encryption secret`SESSION_COOKIE_NAME`Session cookie name (optional)`TOKEN_SALT_COMPLEXITY`Token salt complexity`MAGIC_LINK_TOKEN_VALIDITY`Magic link token validity (hours)`ACCESS_TOKEN_VALIDITY`Access token validity (ms)`REFRESH_TOKEN_VALIDITY`Refresh token validity (ms)**Rate Limiting**`RATE_LIMIT_TTL`Rate limit time-to-live`RATE_LIMIT_MAX`Maximum requests within TTL**Analytics**`ALLOW_ANALYTICS_COLLECTION`Enable/disable analytics collection**History**`USER_HISTORY_STORE_ENABLED`Enable/disable user history storage**Mock Server**`MOCK_SERVER_WILDCARD_DOMAIN`Wildcard domain for mock server
## API Reference (Backend GraphQL)
### Admin Queries
#### `infra: Infra`
Fetches the infrastructure object as a root query, which then exposes resolved fields for metrics, users, teams, etc.

>
Source: [infra.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/infra.resolver.ts#L46-L53)

#### `admin: Admin`
Returns details of the currently authenticated admin user.

>
Source: [admin.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.resolver.ts#L40-L46)

#### `infraConfigs(configNames: [InfraConfigEnum!]!): [InfraConfig!]!`
Retrieves configuration values for the specified configuration names.

>
Source: [infra.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/infra.resolver.ts#L289-L304)

### Admin Mutations
#### `inviteNewUser(inviteeEmail: String!): InvitedUser!`
Sends an email invitation to a new user to join the infrastructure.

>
Source: [admin.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.resolver.ts#L50-L69)

#### `removeUsersByAdmin(userUIDs: [ID!]!): [UserDeletionResult!]!`
Deletes one or more non-admin user accounts from the infrastructure.

>
Source: [admin.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.resolver.ts#L106-L122)

#### `makeUsersAdmin(userUIDs: [ID!]!): Boolean!`
Promotes one or more users to admin role.

>
Source: [admin.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.resolver.ts#L145-L157)

#### `demoteUsersByAdmin(userUIDs: [ID!]!): Boolean!`
Demotes one or more admins to regular users. At least one admin must remain.

>
Source: [admin.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.resolver.ts#L205-L217)

#### `createTeamByAdmin(userUid: ID!, name: String!): Team!`
Creates a new team with the specified user as the team owner.

>
Source: [admin.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.resolver.ts#L219-L238)

#### `addUserToTeamByAdmin(teamID: ID!, userEmail: String!, role: TeamAccessRole!): TeamMember!`
Adds a user to a team by email with the specified role.

>
Source: [admin.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.resolver.ts#L281-L296)

#### `updateInfraConfigs(infraConfigs: [InfraConfigArgs!]!): [InfraConfig!]!`
Updates one or more infrastructure configuration values.

>
Source: [infra.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/infra.resolver.ts#L316-L331)

#### `toggleAnalyticsCollection(status: ServiceStatus!): Boolean!`
Enables or disables anonymous analytics collection.

>
Source: [infra.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/infra.resolver.ts#L333-L350)

#### `toggleSMTP(status: ServiceStatus!): Boolean!`
Enables or disables SMTP for sending emails.

>
Source: [infra.resolver.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/infra.resolver.ts#L381-L397)

## Deployment
The Admin Dashboard is containerized using Docker with a multi-stage build process:

dockerfile1# Initial stage, just build the app
2FROM node:lts as builder
3WORKDIR /usr/src/app
4RUN npm i -g pnpm
5COPY . .
6RUN pnpm install --force --frozen-lockfile
7WORKDIR /usr/src/app/packages/hoppscotch-sh-admin/
8RUN pnpm run build
9
10# Final stage, package into a static Caddy server
11FROM caddy:2-alpine
12WORKDIR /site
13COPY packages/hoppscotch-sh-admin/Caddyfile /etc/caddy/Caddyfile
14COPY --from=builder /usr/src/app/packages/hoppscotch-sh-admin/dist/ .
15EXPOSE 8080
>
Source: [Dockerfile](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/Dockerfile#L1-L21)

The production Caddy configuration serves the built static files:

1{
2  admin off
3  persist_config off
4}
5
6:8080 {
7  try_files {path} /
8  root * /site
9  file_server
10}
>
Source: [Caddyfile](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/Caddyfile#L1-L10)

## Project Structure
1packages/hoppscotch-sh-admin/
2├── Dockerfile                    # Production Docker build
3├── Caddyfile                     # Caddy web server config
4├── package.json                  # Dependencies and scripts
5├── index.html                    # Entry HTML
6├── src/
7│   ├── App.vue                   # Root Vue component
8│   ├── components/
9│   │   ├── app/                  # Shell components (Header, Sidebar, Login)
10│   │   ├── dashboard/            # Dashboard-specific components (MetricsCard)
11│   │   ├── settings/             # Settings pages components
12│   │   ├── teams/                # Team management components
13│   │   ├── users/                # User management components
14│   │   ├── tokens/               # Infra token components
15│   │   ├── onboarding/           # Onboarding flow components
16│   │   └── setup/                # Setup flow components
17│   ├── pages/                    # File-based routing pages
18│   │   ├── dashboard.vue         # Main dashboard page
19│   │   ├── users/                # User pages
20│   │   ├── teams/                # Team pages
21│   │   └── settings.vue          # Settings page
22│   ├── helpers/                  # Utility helpers
23│   │   ├── backend/
24│   │   │   ├── gql/              # GraphQL queries and mutations
25│   │   │   └── rest/             # REST API definitions
26│   │   ├── auth.ts               # Authentication helper
27│   │   └── configs.ts            # Configuration definitions
28│   ├── composables/              # Vue composables
29│   └── modules/                  # App modules (router, i18n, etc.)
30└── locales/                      # i18n translations
31    └── en.json                   # English translations
## Related Links

- [Self-Hosted Admin Dashboard Source Code](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin)
- [Admin Backend Module](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin)
- [Backend Admin Service](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.service.ts)
- [Backend Admin Resolver](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/admin.resolver.ts)
- [Backend Infra Resolver](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/infra.resolver.ts)
- [GraphQL Queries for Admin](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/helpers/backend/gql/queries)
- [GraphQL Mutations for Admin](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/helpers/backend/gql/mutations)
- [Dashboard Page (Frontend)](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/pages/dashboard.vue)
- [Dashboard MetricsCard Component](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/components/dashboard/MetricsCard.vue)
- [Admin Sidebar Navigation](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-sh-admin/src/components/app/Sidebar.vue)
- [Admin Route Guards](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/admin/guards)
- [Infrastructure Configuration Service](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/infra-config)