/**
 * The emphasis delimiter rules, in one place.
 *
 * Three renderers read the same note body: the web WYSIWYG editor
 * (components/notes/editor/markdownDom.ts), the read-only renderer used by
 * native and previews (components/notes/MarkdownView.tsx), and the plain-text
 * stripper behind note previews and display titles (stripMarkdown in
 * lib/utils.ts). Each used to carry its own copy of these four regexes, and
 * copies drift — which is why a note card could show "filenamehere.txt" for a
 * body that read `file_name_here.txt` while the editor showed it correctly.
 *
 * The rules are CommonMark's flanking rules, reduced to what this app supports:
 *
 *  - A delimiter can only OPEN when the character after it is not whitespace,
 *    and can only CLOSE when the character before it is not whitespace. That is
 *    what stops `2 * 3 * 4 = 24` from turning into `2 <i> 3 </i> 4 = 24`.
 *  - `_` additionally refuses to open or close against an alphanumeric, so it
 *    is inert inside identifiers and filenames (`snake_case`, `file_name.txt`)
 *    while `*` stays available for mid-word emphasis.
 *  - `(?!\*)` / `(?<!\*)` on the single-character forms stops them chewing into
 *    a neighbouring `**` run, so an empty `****` stays literal instead of being
 *    read as an italicised asterisk.
 *
 * Deliberately dependency-free: markdownDom.ts imports it by relative path so
 * `npm run test:markdown` can compile the pair standalone, without the module
 * alias or a React dependency coming along.
 */

/** `**bold**` */
export const MD_BOLD_STARS = /\*\*(?=\S)(.+?)(?<=\S)\*\*/s;
/** `__bold__` */
export const MD_BOLD_UNDERSCORES = /(?<![A-Za-z0-9])__(?=\S)(.+?)(?<=\S)__(?![A-Za-z0-9])/s;
/** `_italic_` */
export const MD_ITALIC_UNDERSCORE = /(?<![A-Za-z0-9_])_(?!_)(?=\S)(.+?)(?<=\S)(?<!_)_(?![A-Za-z0-9_])/s;
/** `*italic*` */
export const MD_ITALIC_STARS = /\*(?!\*)(?=\S)(.+?)(?<=\S)(?<!\*)\*/s;
/** `` `code` `` */
export const MD_CODE = /`(.+?)`/s;
/** `[[Wiki Link]]` */
export const MD_WIKILINK = /\[\[(.+?)\]\]/s;

/** Same patterns with the global flag, for whole-string replacement. */
export const MD_EMPHASIS_GLOBAL = [
  MD_BOLD_STARS,
  MD_BOLD_UNDERSCORES,
  MD_ITALIC_UNDERSCORE,
  MD_ITALIC_STARS,
  MD_CODE,
].map(re => new RegExp(re.source, "gs"));
