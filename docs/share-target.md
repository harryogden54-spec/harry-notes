# Sharing into Dump

Anything you can share from another app can land in Dump as a capture, without
retyping it. There are two routes, because the two platforms differ.

Both end up at the same place: `GET /share?title=…&text=…&url=…`, handled by
[`app/share.tsx`](../app/share.tsx). It creates one Dump capture tagged
**Knowledge** and drops you on the Dump screen. Change the tag there if it isn't
knowledge — the tag is a one-line default in `app/share.tsx`, so tell Claude if
you'd rather it defaulted to something else.

## Android / desktop Chrome — native share sheet

Nothing to set up. `share_target` in `public/manifest.json` registers the app
with the OS, so once harry notes is installed as a PWA it appears in the share
sheet directly.

## iPhone — via a Shortcut

**iOS Safari does not implement the Web Share Target API.** The manifest entry
is simply inert there; no amount of PWA configuration will put harry notes in
the iOS share sheet. A Shortcut gets you the same result in about a minute:

1. Shortcuts app → **+** → rename it something like "Dump this".
2. Tap the **ⓘ** (Details) at the bottom → enable **Show in Share Sheet**.
3. Under *Share Sheet Types*, leave **Text** and **URLs** on; turn the rest off.
4. Add action **Text**, and set its content to the **Shortcut Input** variable.
5. Add action **URL**, set to:
   ```
   https://harry-notes.pages.dev/share?text=
   ```
   then append the **Text** variable from step 4 immediately after `text=`.
6. Add action **Open URLs**.

Now share any page or selection → *Dump this* → it opens the PWA on Dump with
the capture already saved.

> Shortcuts URL-encodes the variable when it is substituted into a URL action, so
> you do not need a separate encode step. If a shared link ever arrives mangled,
> add a **URL Encode** action between steps 4 and 5.

## What isn't supported

Shared **files and images** don't work. That would need `method: "POST"` with a
multipart enctype, and there is no server to receive it — Cloudflare Pages serves
this app as static files with an SPA fallback. Text, titles and URLs only.
