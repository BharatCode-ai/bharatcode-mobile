// Only app-authored copy crosses the presentation boundary.
export function describeIssue(
  message: string,
  fallback: string,
  desktop = "your computer",
  status?: number,
) {
  const issue = (title: string, detail: string, pair = false) => ({
    title,
    detail,
    pair,
  });
  const code = status ?? Number(message.match(/request \((\d{3})\)/)?.[1]);
  if (message.startsWith("reply/")) {
    switch (message.slice(6)) {
      case "stopped":
        return issue(
          "Reply stopped",
          "You can send a follow-up when you’re ready.",
        );
      case "length":
        return issue(
          "The model reached its length limit",
          "Ask for a shorter response or start a new chat with less context.",
        );
      case "access":
        return issue(
          "The model needs authorization",
          "Check the provider connection in Desktop or choose another model.",
        );
      case "billing":
        return issue(
          "Provider credits are unavailable",
          "Check billing for the provider on Desktop or choose another model.",
        );
      case "busy":
        return issue(
          "The model is busy",
          "Give it a moment before sending a follow-up, or choose another model.",
        );
      default:
        return issue(
          "The reply was interrupted",
          "Check the model on Desktop, then send a follow-up to continue.",
        );
    }
  }
  if (message === "Prompt delivery conflict")
    return issue(
      "Check this message on Desktop",
      "Desktop couldn’t confirm the original message. Check the conversation there before sending again or starting a new chat.",
    );
  if (message === "File unavailable on mobile")
    return issue(
      "This file can’t be opened here",
      "Choose another file inside this project, or open it directly on Desktop.",
    );
  if (/unconfirmed/i.test(message))
    return issue(
      "Message delivery is unconfirmed",
      "Check the conversation before retrying. You can restore the original message in the composer.",
    );
  if (/message sent/i.test(message))
    return issue(
      "Message sent",
      "Conversation updates are delayed. Reopen this chat to check for a reply.",
    );
  if (message === "Outgoing message storage unavailable")
    return issue(
      "Message wasn’t sent",
      "Your phone couldn’t save the outgoing message. Keep the draft open, check available storage, then try sending again.",
    );
  if (/draft could not be saved/i.test(message))
    return issue(
      "Your draft hasn’t been saved",
      "Keep this chat open and copy your text before leaving.",
    );
  if (/removed from this phone/i.test(message))
    return issue(
      "Computer removed from this phone",
      "Open Mobile devices on Desktop to revoke this phone’s access there too.",
    );
  if (/clipboard/i.test(message))
    return issue(
      "Clipboard unavailable",
      "Select the text to copy it manually, or type your message in the composer.",
    );
  if (/open external link/i.test(message))
    return issue(
      "Couldn’t open that link",
      "Copy the link and open it in your browser.",
    );
  if (
    /local history|local storage|SQLite|disk is full|no space left/i.test(
      message,
    )
  )
    return issue(
      "Local storage is unavailable",
      "Check your phone’s available storage, then reopen BharatCode.",
    );
  if (/conversation changed|select a conversation/i.test(message))
    return issue(
      "Open the chat again",
      "Return to Chats and open the conversation you want to use.",
    );
  if (
    /unexpected server response|unexpected connection redirect|exceeds supported size/i.test(
      message,
    )
  )
    return issue(
      "Desktop sent an unreadable response",
      "Check that Desktop is up to date and reopen this view.",
    );
  if (/approval delivery/i.test(message))
    return issue(
      "Decision not confirmed",
      "Refresh Activity to check whether Desktop received your decision before answering again.",
    );
  if (/stop delivery/i.test(message))
    return issue(
      "Stop not confirmed",
      "Check Activity to see whether the session is still running.",
    );
  if (/create delivery/i.test(message))
    return issue(
      "New chat not confirmed",
      "Refresh Chats to see whether Desktop created it before starting another.",
    );
  if (code === 409 && !/identity|protocol/i.test(message))
    return issue(
      "This item has changed",
      "Refresh the view and check its current state on Desktop.",
    );
  if (code === 400 || code === 422)
    return issue(
      "Desktop couldn’t use that input",
      "Check your selection or entry and try again.",
    );
  if (/expired/i.test(message))
    return issue(
      "Pairing code expired or invalid",
      "Get a fresh code in Desktop Settings → Mobile devices, then scan it here.",
    );
  if (
    /identity|pair again|no longer authorized|saved pairing/i.test(message) ||
    code === 401
  )
    return issue(
      "Pair this phone again",
      "Open Settings → Mobile devices in BharatCode Desktop and scan a fresh pairing code.",
      true,
    );
  if (/pairing (code|QR|link)|pairing link|scanned code/i.test(message))
    return issue(
      "That pairing code couldn’t be used",
      "Open Settings → Mobile devices in BharatCode Desktop and use the latest code.",
    );
  if (/declined/i.test(message))
    return issue(
      "Pairing was declined",
      "Start pairing again when you’re ready to approve this phone on Desktop.",
    );
  if (/ssl|handshake|certificate|\btls\b/i.test(message))
    return issue(
      "Couldn’t connect securely",
      `Check that BharatCode Desktop is open on ${desktop} and both devices are online, then try again.`,
    );
  if (/timed? ?out|timeout/i.test(message) || code === 408 || code === 504)
    return issue(
      "Desktop took too long to respond",
      "Check your connection and try again in a moment.",
    );
  if (
    /network|offline|fetch failed|failed to fetch|connection (closed|interrupted)|unreachable|could not reach/i.test(
      message,
    )
  )
    return issue(
      "Can’t reach Desktop",
      `Check that BharatCode Desktop is open on ${desktop} and both devices are online.`,
    );
  if (code === 403)
    return issue(
      "Access wasn’t granted",
      "Check this phone’s access in Mobile devices on Desktop.",
    );
  if (code === 404 || /was resolved on Desktop/.test(message))
    return issue(
      "This item is unavailable",
      "Refresh the view to see what’s still available on Desktop.",
    );
  if (code === 413 || /too large/i.test(message))
    return issue(
      "Too much to load at once",
      "Open a smaller file or load fewer items.",
    );
  if (code === 429 || code === 529)
    return issue(
      "Too many requests right now",
      "Wait a moment before trying again.",
    );
  if (code >= 500)
    return issue(
      "Desktop couldn’t finish the request",
      "Give it a moment, then try again.",
    );
  return issue(
    fallback,
    "Return to the previous view and try again. If this keeps happening, check BharatCode Desktop.",
  );
}
