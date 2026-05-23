# Hoppscotch Component Index

Key UI components in `packages/hoppscotch-common/src/components/`.
## Root Components

- `MonacoScriptEditor.vue`
- `TabsNav.vue`

Each section maps to a request type or shared feature area.

## accessTokens/

- `GenerateModal.vue`
- `List.vue`
- `Overview.vue`
- `index.vue`

## aiexperiments/

- `MergeView.vue`
- `ModifyBodyModal.vue`
- `ModifyPreRequestModal.vue`
- `ModifyTestScriptModal.vue`

## app/

- `ActionHandler.vue`
- `Banner.vue`
- `ContextMenu.vue`
- `DeveloperOptions.vue`
- `Footer.vue`
- `GitHubStarButton.vue`
- `Header.vue`
- `Inspection.vue`
- `KernelInterceptor.vue`
- `Logo.vue`
- `Markdown.vue`
- `Options.vue`
- `PaneLayout.vue`
- `Share.vue`
- `Shortcuts.vue`
- `ShortcutsEntry.vue`
- `ShortcutsPrompt.vue`
- `Sidenav.vue`
- `SpotlightSearch.vue`
- `Support.vue`
- `WhatsNewDialog.vue`

## collections/
*Collection/sidebar tree view*

- `Add.vue`
- `AddFolder.vue`
- `AddRequest.vue`
- `Collection.vue`
- `Edit.vue`
- `EditFolder.vue`
- `EditRequest.vue`
- `EditResponse.vue`
- `ExampleResponse.vue`
- `ImportExport.vue`
- `MyCollections.vue`
- `Properties.vue`
- `Request.vue`
- `SaveRequest.vue`
- `TeamCollections.vue`
- `Variables.vue`
- `index.vue`

### collections/documentation/
*Documentation mode — collection/request documentation preview and editing*

- `index.vue` — Documentation modal entry point (DocumentationModal)
- `Preview.vue` — Documentation preview container
- `RequestItem.vue` — Request entry in documentation tree
- `FolderItem.vue` — Folder entry in documentation tree
- `RequestPreview.vue` — Request documentation preview (edit/preview mode toggle, markdown editing, getResponseExamples)
- `CollectionPreview.vue` — Collection documentation preview
- `CollectionStructure.vue` — Collection structure navigation sidebar
- `MarkdownEditor.vue` — Markdown editor for documentation descriptions
- `LazyDocumentationItem.vue` — Lazy-loaded documentation item wrapper
- `EnvironmentPicker.vue` — Environment selector for published docs
- `PublishDocModal.vue` — Publish documentation modal
- `PublishDocForm.vue` — Publish documentation form
- `PublishDocSnapshotPreview.vue` — Published doc snapshot preview
- `sections/Response.vue` — Response section display (supports responseModels + responses dual data source, dual-column layout with bodySchemaTree)
- `sections/RequestBody.vue` — Request body section
- `sections/Headers.vue` — Request headers section
- `sections/Parameters.vue` — Query parameters section
- `sections/PathParams.vue` — Path parameters section
- `sections/Variables.vue` — Request variables section
- `sections/Auth.vue` — Authentication section
- `sections/CurlView.vue` — cURL command view

## console/

- `Item.vue`
- `Panel.vue`
- `Value.vue`

## cookies/

- `AllModal.vue`
- `EditCookie.vue`

## documentation/

- `Content.vue`
- `Header.vue`
- `Skeleton.vue`

## embeds/

- `Header.vue`
- `Request.vue`
- `index.vue`

## environments/

- `Add.vue`
- `ImportExport.vue`
- `Properties.vue`
- `Selector.vue`
- `index.vue`

## firebase/

- `Login.vue`
- `Logout.vue`

## graphql/
*GraphQL request/response UI*

- `Argument.vue`
- `Arguments.vue`
- `Authorization.vue`
- `DefaultValue.vue`
- `Directives.vue`
- `DocExplorer.vue`
- `EnumValues.vue`
- `ExplorerSection.vue`
- `Field.vue`
- `FieldDocumentation.vue`
- `FieldLink.vue`
- `Fields.vue`
- `Headers.vue`
- `ImplementsInterfaces.vue`
- `Query.vue`
- `Request.vue`
- `RequestOptions.vue`
- `RequestTab.vue`
- `Response.vue`
- `ResponseMeta.vue`
- `SchemaDocumentation.vue`
- `SchemaSearch.vue`
- `Sidebar.vue`
- `SubscriptionLog.vue`
- `TabHead.vue`
- `Type.vue`
- `TypeDocumentation.vue`
- `TypeLink.vue`
- `Variable.vue`

## history/

- `Personal.vue`
- `index.vue`

## http/
*REST API request/response UI — the primary client interface*

- `Authorization.vue`
- `Body.vue`
- `BodyBinary.vue`
- `BodyParameters.vue`
- `Codegen.vue`
- `CodegenModal.vue`
- `Headers.vue`
- `ImportCurl.vue`
- `InheritedScriptsModal.vue`
- `KeyValue.vue`
- `Parameters.vue`
- `PathParams.vue`
- `PreRequestScript.vue`
- `RawBody.vue`
- `ReqChangeConfirmModal.vue`
- `Request.vue`
- `RequestOptions.vue`
- `RequestTab.vue`
- `RequestVariables.vue`
- `Response.vue`
- `ResponseInterface.vue`
- `ResponseMeta.vue`
- `SaveResponseName.vue`
- `Sidebar.vue`
- `TabHead.vue`
- `TestResult.vue`
- `TestResultEntry.vue`
- `TestResultEnv.vue`
- `TestResultReport.vue`
- `Tests.vue`
- `URLEncodedParams.vue`

### http/design/
*Design mode — visual schema editing and API design*

- `EditView.vue` — Design edit view entry point (contains MetaInfoSection + RequestOptions + ResponseSection)
- `PreviewView.vue` — Design preview view (two-column layout: SchemaTreeReadonly + JsonExampleBlock)
- `ResponseSection.vue` — Response model editor (manages responseModels array, add/remove/edit models)
- `SchemaTreeEditor.vue` — Visual schema tree editor (add/edit/delete fields recursively)
- `SchemaTreeReadonly.vue` — Read-only schema tree display
- `SchemaTreeRow.vue` — Single schema tree row (handles type, mock, required, children)
- `JsonExampleBlock.vue` — JSON example code block (syntax highlighting, editable, copyable)
- `StatusBadge.vue` — API status badge (developing/Testing/Released/Deprecated)
- `MetaInfoSection.vue` — API meta info editor (description, tags, responsibility, base URL)
- `RequestParamsSection.vue` — Request parameters section for design mode
- `TagInput.vue` — Tag input component

## importExport/

- `Base.vue`
- `ImportExportList.vue`
- `ImportExportSourcesList.vue`

## instance/

- `Switcher.vue`

## lenses/

- `ActualRequestRenderer.vue`
- `HeadersRenderer.vue`
- `HeadersRendererEntry.vue`
- `ResponseBodyRenderer.vue`

## mockServer/

- `ConfigureMockServerModal.vue`
- `CreateNewMockServerModal.vue`
- `EditMockServer.vue`
- `LogSection.vue`
- `MockServerCreatedInfo.vue`
- `MockServerDashboard.vue`
- `MockServerLogs.vue`

## organization/

- `Switcher.vue`

## profile/
*User profile and settings*

- `UserDelete.vue`
- `index.vue`

## realtime/
*WebSocket, SSE, Socket.IO, MQTT clients*

- `Communication.vue`
- `ConnectionConfig.vue`
- `Log.vue`
- `LogEntry.vue`
- `Subscription.vue`

## settings/

- `Agent.vue`
- `AgentSubtitle.vue`
- `Desktop.vue`
- `Extension.vue`
- `ExtensionSubtitle.vue`
- `InterceptorErrorPlaceholder.vue`
- `Native.vue`
- `Proxy.vue`

## share/

- `CreateModal.vue`
- `CustomizeModal.vue`
- `Modal.vue`
- `Request.vue`
- `index.vue`

## smart/
*Smart components (SmartEnvInput, SmartUrlField)*

- `AccentModePicker.vue`
- `ChangeLanguage.vue`
- `ColorModePicker.vue`
- `EncodingPicker.vue`
- `EnvInput.vue`

## tab/

- `Primary.vue`
- `Secondary.vue`

## teams/
*Team collaboration features*

- `Add.vue`
- `Edit.vue`
- `Invite.vue`
- `MemberStack.vue`
- `Modal.vue`
- `Team.vue`
- `View.vue`

## workspace/

- `Current.vue`
- `Selector.vue`
