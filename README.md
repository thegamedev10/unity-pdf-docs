# unity-pdf-docs

Convert unity docs to pdf.

## Just Download

You can just download the latest generated docs from this repository:

[Unity Manual.pdf]()

## Installation

```sh
npm install -g unity-pdf-docs
```

## Usage

First download the unity documentation [from this
link](https://docs.unity3d.com/uploads/UnityDocumentation.zip) and unzip it.

Then run the below:

```sh
unity-pdf-docs <unity-docs-root>
```

Where `<unity-docs-root>` is the location where the downloaded docs where stored, i.e.

```
/Users/bobby-tables/Downloads/Documentation/en
```

**NOTE:** make sure to include the language sub folder, i.e. `/en`

## Combining into one PDF

The resulting pdfs will be stored inside a `pdf` folder inside the provided Unity Manual
folder.
They are numbered in order and can easily be merged into one file by opening the first one and
dragging the remaining files into the _thumbnail_ section of the Preview.app sidebar for
instance.

## Updating the Doc File Names

The filenames where obtained by running the below script from dev tools on the unity docs site.
The names were then pasted into `pages.json` from the clipboard.

```js
var anchors = document.querySelectorAll('.mCSB_container a')
var hrefs = new Set()
var originLen = location.origin.length
for (var anchor of anchors) {
  hrefs.add(anchor.href.slice(originLen + 1))
}
copy(Array.from(hrefs))
```

## License

MIT
