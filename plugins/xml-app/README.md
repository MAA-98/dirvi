# XML dirvi app plugin

The XML dirvi app plugin lets dirvi load, browse and edit XML data as interactive tree srtuctures. 

## Default view

By default, shows the document structure without applying specialized leaf rules.

Elements can be expanded to reveal their child nodes, including text, CDATA,
comments, and processing instructions. Whitespace-only text nodes are visible, 
including what would be considered newlines for formatting:

```xml
<library>
  <book>My book</book>
</library>
```

would give by default:
```txt
library
  text
  book
    text
  text
```

This is usually not desirable, and a way to filter the nodes to only show such 
 whitespace formatting in subtrees with `xml:space="preserve"` is provided.

Attributes are not child nodes of elements, but are inspectable and changeable.

## View options

### Filter whitespace-only text

- Default: off.
- Hide text nodes containing only XML whitespace.
- Do not hide whitespace where `xml:space="preserve"` applies.

### Treat text-only elements as leaves

- Default: off.
- Treat an element as a leaf when all of its children are text or CDATA.
- An empty element also qualifies.
- Edit its contents as plain text.

Saving plain text replaces the element's contents with text. Markup typed into
the editor is text, not a request to create XML elements. CDATA boundaries
need not be retained.

### Treat extension-marked elements as leaves

- Default: off.
- Configure the attribute name used to specify a file extension.
- An element with that attribute is a leaf, edited as plain text.
- Open the editor with a temporary filename using the specified extension, so
  the editor can choose syntax highlighting.
- The extension rule takes precedence over the other leaf rules.

For example, assuming the configured attribute is `extension`:

```xml
<snippet extension="tsx">const App = () =&gt; &lt;div&gt;Hello&lt;/div&gt;;</snippet>
```

The editor receives:

```tsx
const App = () => <div>Hello</div>;
```

After saving, the contents are still text, and the element remains a leaf.
If an extension-marked element contains child elements or other non-text
content, report an error rather than silently flattening or discarding it.

Treat the extension as data, not as a path or shell command. Reject unsafe
values before constructing a temporary filename.

### Treat `xml:space="preserve"` elements as leaves

- Default: off.
- An element with `xml:space="preserve"` directly on it is a leaf.
- Edit its contents as **inner XML**, including any nested markup.
- Parse the edited contents as XML on save.

For example, the editor for this element:

```xml
<note xml:space="preserve">Hello <em>world</em>.</note>
```

receives:

```xml
Hello <em>world</em>.
```

The extension rule takes precedence if both rules apply.

`xml:space` can be inherited in XML. For this view option, however, only the
element that directly declares `xml:space="preserve"` becomes a leaf.

## Editing and saving

- Open editable content in an external editor through a temporary file.
- Distinguish plain-text editing from inner-XML editing. Never parse plain-text
  edits as XML markup.
- For inner-XML edits, support multiple child nodes and namespace declarations
  inherited from ancestors.
- Reject invalid edits without overwriting the original file.
- Detect if the original file changed while the editor was open; do not
  silently overwrite those changes.
- Clean up temporary files after editing.
- Preserve document content not intentionally edited, even if its serialized
  formatting changes. In particular, do not add or remove meaningful
  whitespace while formatting.
- Report unsupported XML features instead of silently losing content.

Creating or restructuring branches should be a separate, intentional user
operation, not a side effect of saving plain text.