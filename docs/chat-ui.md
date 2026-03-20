# Chat UI

The built-in Chat UI lets you talk to any model configured in your router directly from the browser or desktop app — no external client needed.

---

## Layout

```
┌─────────────────┬──────────────────────────────────────┐
│  Conversation   │   Column A        │   Column B        │
│  sidebar        │   (gpt-4o)        │   (claude-3-7)    │
│                 │                   │                   │
│  Today          │   [messages]      │   [messages]      │
│  > Chat 1       │                   │                   │
│  > Chat 2       ├───────────────────┴───────────────────┤
│                 │   [input area + attachments]           │
└─────────────────┴────────────────────────────────────────┘
```

---

## Multi-column comparison

You can open up to **4 columns** side by side, each talking to a different model.

- Click **+ Add column** in the top bar to add a column.
- Select a model and protocol (OpenAI / Anthropic) per column.
- Each message you send goes to **all columns simultaneously**.
- The response for each model streams independently.

This is useful for comparing models on the same prompt.

---

## Model selector

- **✦ auto** (default) — the router automatically picks the best available model based on priority and capability.
- Choose any specific model configured in your Models list.
- The protocol selector (OpenAI / Anthropic) controls which API format the frontend uses to call the router. Set this to match your model's provider protocol for best results.

---

## File attachments

Click the **paperclip icon** or drag-and-drop files into the input area.

| Type | Supported formats | Size limit |
|------|------------------|------------|
| Image | jpg, png, gif, webp, … | 100 MB |
| Audio | mp3, wav, ogg, webm, m4a | 25 MB |
| Video | mp4, webm, mov | 100 MB |
| Document | pdf, txt, docx, xlsx, csv, json, html, … | 20 MB |

You can also **paste** images directly from the clipboard.

**Capability check:** If a selected model doesn't support the attachment type (e.g. no `input_image` flag), a warning icon appears on the column header and the send is blocked with an error toast.

**Storage:** Attachment data is stored in the browser's IndexedDB, not in localStorage. This avoids the 5 MB localStorage limit. Attachments are automatically deleted when the conversation is deleted.

---

## Parameters panel

Click the **⚙ gear icon** on any column header to open its parameters panel.

| Parameter | Default | Notes |
|-----------|---------|-------|
| **Temperature** | 0.7 | 0 = deterministic, 2 = most creative |
| **Top P** | 0 (skip) | Nucleus sampling. Set to 0 to not send. |
| **Frequency Penalty** | 0 | -2 to +2. Penalizes repeated tokens. |
| **Presence Penalty** | 0 | -2 to +2. Encourages new topics. |
| **Max tokens** | 0 (model default) | Maximum tokens to generate. |
| **Context messages** | 0 (unlimited) | Limit how many past messages are sent. |
| **No thinking** | off | Anthropic only. Sends `thinking:{type:"disabled"}`. |
| **System prompt** | (empty) | Prepended as the system message. |

Parameters are saved per-column and persisted with the conversation.

---

## Thinking blocks

For reasoning models (e.g. Claude with extended thinking), the model may output a `<think>...</think>` block before the answer.

- While streaming: a **"Thinking…"** animated header is shown, collapsed by default.
- After streaming: shows **"Show thinking"** / **"Hide thinking"** toggle.
- Click to expand and read the full reasoning trace.

To suppress thinking for a model that has it on by default, enable **No thinking** in the parameters panel.

---

## Web search

Click the **globe icon** in the input bar to enable web search. When enabled, the router queries your configured search provider before sending the message, and injects the results into the prompt as context.

Configure the search provider in **Settings** → Search Provider.

---

## Conversation history

Conversations are saved automatically to browser **localStorage** after each assistant response.

The sidebar groups conversations by recency: Today / Yesterday / Last 7 days / Older.

**Actions per conversation:**
- Click to load
- Double-click the title to rename
- Hover → trash icon to delete (also cleans up attachment data from IndexedDB)
- **Clear all** button at the bottom removes all conversations and their attachments

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line in input |
| `Ctrl/Cmd + K` | (planned) New chat |
