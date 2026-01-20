// ABCT Grammar - A DSL for transforming ABC music notation
// Based on the spec at plans/9.abct-language-spec.md
// Includes source location tracking for semantic highlighting

{{
  // Helper to build left-associative binary expressions with location tracking
  // Each element in tail should be { opLoc, right } for binary expressions
  // or { kwLoc, right } for logical expressions
  function buildBinaryLeft(head, tail, type, locKey) {
    return tail.reduce((left, element) => {
      const node = {
        type,
        left,
        right: element.right,
        loc: {
          start: left.loc.start,
          end: element.right.loc.end
        }
      };
      node[locKey] = element[locKey];
      return node;
    }, head);
  }
}}

// ============================================================================
// Program Structure
// ============================================================================

program
  = statements:statement* _ {
      const loc = location();
      return { type: "program", statements, loc };
    }

statement
  = _ a:assignment { return a; }
  / _ e:expr { return e; }

assignment
  = id:identifier_with_loc _ eqLoc:eq_op _ value:expr {
      return {
        type: "assignment",
        id: id.name,
        idLoc: id.loc,
        eqLoc,
        value,
        loc: { start: id.loc.start, end: value.loc.end }
      };
    }

eq_op
  = "=" { return location(); }

// ============================================================================
// Expression Hierarchy (lowest to highest precedence)
// ============================================================================

expr
  = pipeline

// Pipe operator: lowest precedence
pipeline
  = head:concat_term tail:(_ opLoc:pipe_op _ right:concat_term { return { opLoc, right }; })* {
      return tail.length === 0 ? head : buildBinaryLeft(head, tail, "pipe", "opLoc");
    }

pipe_op
  = "|" !("=") { return location(); }

// Concatenation: second lowest
concat_term
  = head:update_term tail:(_ opLoc:concat_op _ right:update_term { return { opLoc, right }; })* {
      return tail.length === 0 ? head : buildBinaryLeft(head, tail, "concat", "opLoc");
    }

concat_op
  = "+" { return location(); }

// Update operator: binds selector to single application
update_term
  = sel:(selector / location_selector) _ opLoc:update_op _ transform:application {
      return {
        type: "update",
        selector: sel,
        opLoc,
        transform,
        loc: { start: sel.loc.start, end: transform.loc.end }
      };
    }
  / application

update_op
  = "|=" { return location(); }

// Selector: @ followed by selector path
selector
  = atLoc:at_symbol path:selector_path {
      return {
        type: "selector",
        atLoc,
        path,
        loc: { start: atLoc.start, end: path.idLoc.end }
      };
    }

at_symbol
  = "@" { return location(); }

// Application: one or more logical terms (function name + args)
// Whitespace separates terms in an application (no newlines - use ws not _)
application
  = head:logical tail:(ws logical)* {
      const terms = [head, ...tail.map(t => t[1])];
      if (terms.length === 1) {
        return terms[0];
      }
      const last = terms[terms.length - 1];
      return {
        type: "application",
        terms,
        loc: { start: head.loc.start, end: last.loc.end }
      };
    }

// ============================================================================
// Logical and Comparison Operators
// ============================================================================

logical
  = or_term

or_term
  = head:and_term tail:(_ kwLoc:or_kw _ right:and_term { return { kwLoc, right }; })* {
      return tail.length === 0 ? head : buildBinaryLeft(head, tail, "or", "kwLoc");
    }

or_kw
  = "or" { return location(); }

and_term
  = head:not_term tail:(_ kwLoc:and_kw _ right:not_term { return { kwLoc, right }; })* {
      return tail.length === 0 ? head : buildBinaryLeft(head, tail, "and", "kwLoc");
    }

and_kw
  = "and" { return location(); }

not_term
  = kwLoc:not_kw _ operand:not_term {
      return {
        type: "not",
        kwLoc,
        operand,
        loc: { start: kwLoc.start, end: operand.loc.end }
      };
    }
  / comparison

not_kw
  = "not" { return location(); }

comparison
  = left:atom _ opLoc:cmp_op_loc _ right:atom {
      return {
        type: "comparison",
        op: opLoc.op,
        opLoc: opLoc.loc,
        left,
        right,
        loc: { start: left.loc.start, end: right.loc.end }
      };
    }
  / atom

cmp_op_loc
  = ">=" { return { op: ">=", loc: location() }; }
  / "<=" { return { op: "<=", loc: location() }; }
  / "==" { return { op: "==", loc: location() }; }
  / "!=" { return { op: "!=", loc: location() }; }
  / ">" { return { op: ">", loc: location() }; }
  / "<" { return { op: "<", loc: location() }; }

// ============================================================================
// Atoms
// ============================================================================

atom
  = "(" _ e:expr _ ")" { return e; }
  / "[" _ items:list_items? _ "]" {
      const loc = location();
      return { type: "list", items: items || [], loc };
    }
  / abc_literal
  / location_selector
  / selector
  / voice_ref
  / file_ref
  / number_literal
  / identifier_atom

number_literal
  = n:number {
      return { type: "number", value: n, loc: location() };
    }

identifier_atom
  = id:identifier_with_loc {
      return { type: "identifier", name: id.name, loc: id.loc };
    }

// Location selector: :line or :line:col for piped input
location_selector
  = ":" loc:location_value {
      const srcLoc = location();
      return { type: "location_selector", ...loc, loc: srcLoc };
    }

// Voice reference: V:name or V:number (used in lists like distribute [V:S, V:A])
voice_ref
  = typeLoc:identifier_with_loc ":" nameLoc:(identifier_with_loc / integer_with_loc) {
      return {
        type: "voice_ref",
        voiceType: typeLoc.name,
        typeLoc: typeLoc.loc,
        name: typeof nameLoc.value !== 'undefined' ? nameLoc.value : nameLoc.name,
        nameLoc: nameLoc.loc,
        loc: { start: typeLoc.loc.start, end: nameLoc.loc.end }
      };
    }

// ============================================================================
// Compound Constructs
// ============================================================================

// File reference with optional location and selector
file_ref
  = pathLoc:path_with_loc locPart:(":" location_value)? selPart:("@" selector_path)? {
      const hasLoc = locPart !== null;
      const hasSel = selPart !== null;
      const endLoc = hasSel ? selPart[1].idLoc.end
                   : hasLoc ? locPart[1].loc.end
                   : pathLoc.loc.end;
      return {
        type: "file_ref",
        path: pathLoc.path,
        pathLoc: pathLoc.loc,
        location: hasLoc ? locPart[1].value : null,
        locationLoc: hasLoc ? locPart[1].loc : null,
        selector: hasSel ? selPart[1] : null,
        loc: { start: pathLoc.loc.start, end: endLoc }
      };
    }

path_with_loc
  = p:path {
      return { path: p, loc: location() };
    }

// Selector path: identifier with optional sub-selector
// Note: range must come before number to match "5-8" before matching just "5"
selector_path
  = idLoc:identifier_with_loc ":" valueLoc:(identifier_with_loc / range_with_loc / number_with_loc) {
      return {
        id: idLoc.name,
        idLoc: idLoc.loc,
        value: typeof valueLoc.value !== 'undefined' ? valueLoc.value : valueLoc.name,
        valueLoc: valueLoc.loc
      };
    }
  / idLoc:identifier_with_loc {
      return { id: idLoc.name, idLoc: idLoc.loc };
    }

// Location: line with optional column and range (returns both value and source location)
location_value
  = line:line_num ":" col:col_num end:range_end? {
      const loc = location();
      const value = end ? { line, col, end } : { line, col };
      return { value, loc };
    }
  / line:line_num {
      const loc = location();
      return { value: { line }, loc };
    }

range_end
  = "-" endLine:line_num ":" endCol:col_num {
      return { type: "multiline", endLine, endCol };
    }
  / "-" endCol:col_num {
      return { type: "singleline", endCol };
    }

// Range for selectors like @M:5-8
range_with_loc
  = start:integer "-" end:integer {
      return { value: { type: "range", start, end }, loc: location() };
    }

number_with_loc
  = n:number {
      return { value: n, loc: location() };
    }

// List items separated by commas
list_items
  = head:expr tail:(_ "," _ expr)* {
      return [head, ...tail.map(t => t[3])];
    }

// ============================================================================
// Literals
// ============================================================================

// ABC literal: <<content>>
abc_literal
  = "<<" content:abc_content ">>" {
      return { type: "abc_literal", content, loc: location() };
    }

abc_content
  = chars:([^>] / ">" [^>])* {
      return chars.map(c => Array.isArray(c) ? c.join("") : c).join("");
    }

// ============================================================================
// Terminals
// ============================================================================

// File path: must have extension
// Note: path_char excludes "." to ensure we match the extension properly
path
  = $(path_segment ("/" path_segment)* "." extension_char+)

path_segment
  = [a-zA-Z0-9_-]+

extension_char
  = [a-zA-Z0-9]

// Identifier with location: starts with letter or underscore
identifier_with_loc
  = !reserved id:$(identifier_start identifier_char*) {
      return { name: id, loc: location() };
    }

// Identifier (raw): for backward compatibility
identifier
  = !reserved id:$(identifier_start identifier_char*) { return id; }

identifier_start
  = [a-zA-Z_]

identifier_char
  = [a-zA-Z0-9_]

// Reserved words that cannot be identifiers
reserved
  = ("and" / "or" / "not") ![a-zA-Z0-9_]

// Number: integer or fraction, optionally negative
number
  = n:$("-"? [0-9]+ ("/" [0-9]+)?) { return n; }

// Integer (no fractions, for line/col numbers)
integer
  = n:$[0-9]+ { return parseInt(n, 10); }

integer_with_loc
  = n:$[0-9]+ {
      return { value: parseInt(n, 10), loc: location() };
    }

line_num
  = integer

col_num
  = integer

// ============================================================================
// Whitespace and Comments
// ============================================================================

// Optional whitespace (including comments and newlines)
_
  = (whitespace / comment)*

// Horizontal whitespace only (no newlines) - used in application to prevent cross-line args
ws
  = [ \t]*

whitespace
  = [ \t\n\r]

// Line comment: # to end of line
comment
  = "#" [^\n\r]* ("\n" / "\r\n" / "\r" / !.)
