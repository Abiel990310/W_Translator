# Bug Report & Analysis

Here are the issues found in the codebase while reviewing the "Word Shredder" extension.

## 1. Variable Scope Issue (`const morphemeMap`)
**Severity:** Medium
**File:** `dictionary.js` / `content.js`

**Issue:**
In `dictionary.js`, you declare `const morphemeMap = ...`. In Chrome Extensions, when multiple scripts are injected via `manifest.json`, they share the same execution context. However, block-scoped variables (`const`, `let`) declared at the top level of a script are *not* attached to the global `window` object and might not be accessible to subsequent scripts depending on strict mode and browser implementation details.

**Fix:**
Change `const morphemeMap` to `var morphemeMap` or explicitly attach it to the window: `window.morphemeMap = ...`.

## 2. Infinite Loop Risk / Double Translation
**Severity:** Low (Mitigated but brittle)
**File:** `content.js`

**Issue:**
The `MutationObserver` triggers `processNode` whenever text is changed. You handle this by checking `!/[a-zA-Z0-9]/.test(text)`.
1.  If a translation output *contains* alphanumeric characters (e.g., `"cute": "Q"`), the observer will trigger again.
2.  If the second pass translates "Q" to something else (e.g., `"q": "丘"`), it eventually stabilizes.
3.  **Risk:** If you ever add a mapping that creates a cycle (e.g., `a -> b` and `b -> a`) where both outputs are alphanumeric, the browser will crash due to an infinite loop.

**Recommendation:**
Ensure the dictionary target values (values in `morphemeMap`) never form a cycle with the keys. The current strategy of mapping to Chinese/Special characters is safe, *except* for the few English fallbacks like `"Q"`.

## 3. Performance (Big O)
**Severity:** Medium
**File:** `content.js` -> `translateEntireString`

**Issue:**
The translation algorithm iterates through `sortedKeys` (which is huge) for *every character position* where a match isn't found immediately.
If a user visits a page with a lot of text that *doesn't* match the dictionary (e.g., a foreign language not in the map, or random strings), the extension checks the entire dictionary list for every single character shift.
Complexity: `O(TextLength * DictionarySize)`. This could freeze the browser on large pages.

**Fix:**
Use a **Trie (Prefix Tree)** data structure. This would allow `O(LongestWordLength)` lookup time, which is significantly faster.

## 4. `contenteditable` Destruction
**Severity:** Funny / High
**File:** `content.js`

**Issue:**
The extension correctly ignores `INPUT` and `TEXTAREA` tags. However, many modern web apps (Gmail, Facebook Messenger, Slack) use `div` or `span` elements with `contenteditable="true"` for text input.
The extension will detect text typed into these fields as "new text" via `MutationObserver` and shred it *as the user types*.

**Fix:**
In `processNode`, check if the node or its parents have `isContentEditable` property.
```javascript
if (node.parentElement && node.parentElement.isContentEditable) return;
```
(Unless, of course, destroying the user's ability to write is intended.)

## 5. Dictionary Overlaps
**Severity:** Low
**File:** `dictionary.js`

**Issue:**
There are duplicate keys in `dictionary.js` (e.g., `"a"` appears in section 1 and implicitly in later sections if redefined).
JavaScript objects handles this by keeping the *last* defined value.
However, `sortedKeys` logic relies on `Object.keys(morphemeMap)`. If you intended to have multiple meanings, only the last one in the file survives.
