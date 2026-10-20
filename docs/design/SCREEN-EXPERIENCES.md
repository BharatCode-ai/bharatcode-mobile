# Screens and experiences

Visual direction selected by the user: first generated concept, `assets/selected-conversation.png`. Other concept images are archived alternatives, not targets. Generated code text is illustrative and is never copied as application logic.

[View the six-screen family board](assets/screen-family.png): pairing, chats, approval, changes, devices, and reconnection. This generated board communicates the screen family; the selected conversation target and written interaction rules take precedence over generation artifacts such as extra message bubbles, sample counts, or line numbers. These are design images, not screenshots of a running mobile app.

## Visual system

| Token | Proposed value | Use |
| --- | --- | --- |
| Canvas | `#181817` | Main warm charcoal surface |
| Surface | `#242422` | Composer, expanded tools, sheets |
| Raised surface | `#2D2D29` | Menus and active controls |
| Main text | `#F2F0E9` | Reading and primary labels |
| Secondary text | `#B9B9B0` | Supporting metadata; verify contrast |
| Brand | `#FF6933` | Primary action and small brand mark |
| On brand | `#20140F` | Filled orange button text; contrast check before implementation |
| Success | `#62D785` | Connected/completed with text or icon |
| Danger | `#FF8B81` | Errors and removed diff lines with redundant markings |

Use Inter for UI/body and JetBrains Mono for code. Bundle licensed font assets; no runtime font download. Body 16/24, secondary 14/20, title 22/28, large empty-state title 28/34, code 13/20. Respect system text scale and reflow layouts.

At 390 logical pixels use 20px content gutters, 8px base spacing, 12–16px inter-group gaps, 24–32px between major sections. Corners: 12px tool panel, 20px composer/sheet, full round for compact icon actions. Use subtle separators; no repeated shadowed cards. Keep assistant text visually open. The selected concept's oversized code/tool blocks can collapse by default to preserve the reading viewport.

Use the real BharatCode bracket/diamond logo and an established consistent line icon set. Never use generated approximations for shipped logo assets. Orange indicates an action, not every active state. Status always includes text/icon so color is not the only signal. Selected-control indicators and focus rings must remain visible.

Default to the selected dark appearance. Offer system/light/dark preference; the light theme is a semantic adaptation of this direction, not the rejected alternate concept. Motion should explain an action: sheet transitions, expansion, message arrival. Respect reduced motion. Use platform-appropriate back gestures, keyboard behavior, camera permissions and haptics.

## 1. First launch and pairing

Layout: small brand mark and BharatCode wordmark; headline Continue from your computer; two short lines explaining that Desktop stays running; primary Scan Desktop QR; text action How to connect. No carousel, account form or tunnel settings.

How to connect opens a short sheet: Open BharatCode Desktop, open Settings > Mobile devices, choose Connect phone. A visible desktop screenshot may be included when the actual implemented flow exists.

Scanner is edge-to-edge camera with a calm frame, Close, instructions and flashlight only if supported. Request camera permission on entry. On denial show Open settings and clear platform-specific recovery; do not repeatedly prompt. A pasted pairing payload may be offered as an accessibility fallback; it is still the same OpenTunnel pairing flow, not a custom URL mode.

After scan, show the computer name and Waiting for approval on your computer with a matching code. Cancel invalidates the pending claim where reachable. Expired code offers Scan again; denial says Connection declined. Success shows computer identity and Continue to chats without unnecessary celebration or a second permission wall.

## 2. Chats

Header: Chats, connected-computer switcher with status, New chat icon with accessible label. Search row searches loaded/local index first and accurately indicates the searched scope. Do not promise server-wide text search until supported.

Project filter opens a bottom sheet listing actual configured locations/projects. List sessions by recent activity with title, project, short preview and state: Running, Needs approval, Waiting for answer or last-updated time. Prefer grouped rows on one surface; no identical floating cards. Pinning is local until a server API supports it.

Tap opens the existing session; long press opens verified actions such as rename/archive/fork. Archived sessions are reachable through a filter if the capability exists. New chat asks for project only if ambiguous, then opens the composer; it uses the same computer's existing providers.

Empty states distinguish No chats yet from No results and Couldn't load chats. The first invites New chat; a filter miss offers Clear filters; a load failure offers Retry. Cached list shows Offline and last contact without presenting stale Running state as live.

## 3. Conversation

Compact header: back to Chats, two-line session title/computer status, more menu. Project/branch row below is collapsible. Root bottom navigation disappears here. Keep safe areas and keyboard insets correct.

User prompts use an understated right-aligned bubble. Assistant replies use full-width text with a small BC mark. Markdown supports headings, lists, tables, links, fenced code and selectable text. Code has filename/language, Copy, horizontal scrolling and Open full screen. Arbitrary generated HTML is not executed.

Tool calls show concise human labels and state. Tap expands exact inputs/results with truncation and explicit full-content access. Completed tools collapse unless the user expanded them. Preserve expansion through updates. Running status says what is known from the server; no fabricated percent or test count.

Composer: multiline input, attachment control for supported content, send/stop, agent/model selector. Attachment preview has remove and loading/error states. Preserve draft per computer/project/session. Submitting clears only after durable admission; retain a recoverable copy for delivery uncertainty. Queue/steer controls use plain labels and explain the server's actual delivery behavior.

While running, show Stop as its own accessible action and allow drafting. A disconnected state keeps draft editing available, shows Computer unreachable or Reconnecting, and prevents accidental submission. Do not silently submit an offline draft after reconnection.

Long-press text selection permits copy. Ask about selection, if included, quotes only the selection into the draft and restores focus without submitting. Copy feedback is unobtrusive. Jump to latest appears when updates arrive below the viewport.

## 4. Agent requests

Permission requests appear inline in the relevant conversation, with an Activity badge elsewhere. Show tool/action, exact command or resource, working directory when relevant, and current scope. Use Allow once and Deny; persistent permissions are offered only if the backend accurately supports the scope and the user deliberately opens that option.

Tap gives immediate pending feedback and disables duplicate decisions. A reply applies only after server confirmation. If Desktop already resolved the request, replace controls with Resolved on Desktop. Network uncertainty remains pending until refreshed; do not replay a different choice automatically.

Questions render their actual server-provided choices, single/multiple selection rules and free-text support. Preserve draft answers through disconnection. Review multiple questions in one sheet with progress; submit only a complete valid answer set.

## 5. Changes and files

Conversation entry is View changes with actual file count. Screen header shows session title and Changes. List groups files using real paths and additions/deletions if supplied. Opening a file shows a unified diff by default with line numbers, additions/deletions distinguished by symbols and color, selectable code and a file switcher.

Use horizontal scroll for code by default; offer wrap. Hide long unchanged regions behind Expand context. Large or binary files receive explicit states instead of blank panels. A read-only preview never implies a patch has been applied or committed.

File browser is a supporting project surface. Breadcrumbs and folder rows lead to read-only source views confined by server/gateway policy. Paths are normalized and authorized on the computer. No arbitrary URL-to-file request or unrestricted host filesystem chooser.

Revert or other destructive actions appear only when the verified capability exists and show exactly which changes will be affected before the user confirms. Git commit/push controls are not invented for the first companion delivery.

## 6. Activity

Group Needs your attention, Running and Recently finished. Entries link to the corresponding conversation/request. Resolve badges across surfaces immediately after the server confirms. Aggregate state is scoped to the selected computer, with an explicit selector for other paired computers.

Show activity only from actual events and refreshed state. A short note in preferences explains that background alerts are not yet enabled. Do not ask for OS notification permission for an unimplemented notification feature.

## 7. Devices and preferences

Devices lists paired computers with friendly name, platform if reported, and last contact. Tap opens status, last successful connection, current mobile credential identity and Remove computer. Add computer opens the same scanner. Computer names are local display names unless a supported server setting exists.

Remove computer confirmation says that local history and pairing on this phone will be removed; it does not delete Desktop chats. Revoke remotely if reachable, otherwise explain that Desktop can revoke the lingering credential. Clearing the mobile app cannot prove server-side revocation.

Preferences include theme, reading size, haptics, downloaded history controls and app/protocol version. No tunnel provider picker, manual hostname field, provider API-key form or BC-account sign-in.

## 8. Desktop pairing

Settings > Mobile devices has a simple remote-access toggle, Connect phone and a paired-phone list. Starting state says Preparing secure connection, not a QR with an unusable address. Ready state shows the QR, expiry and Refresh QR. Explanatory copy says that the computer must stay online and BharatCode running.

Incoming claim is a focused approval dialog with phone label and matching code. Approve and Decline are explicit; scanning alone does not grant control. Device rows show last contact and Revoke access. Revocation immediately closes active mobile streams. Turning remote access off closes the tunnel while preserving pairing records for later re-enable.

Follow existing Desktop IPC boundaries and localization requirements: renderer uses preload APIs, main IPC handlers live in their established module, and user-visible strings use typed localization keys.

## Verification matrix

Every screen must be exercised in loading, content, empty and recoverable error states where applicable. Also verify narrow Android and iPhone sizes, landscape, tablet split layout, keyboard shown/hidden, text scale 200%, screen-reader traversal and reduced motion. Controls should have at least a 48 logical-pixel touch target where possible and never less than platform minimums. A static image does not prove interaction or accessibility.

Keep one tested-control inventory. Test actual clicks/taps for back, device/project switching, scan/cancel, QR refresh, send/stop, model/agent pickers, attachment removal, tool expansion, copy, changes navigation, request decisions, retry, cache clearing and device revocation. Record real expected outcomes rather than relying on screenshots alone.
