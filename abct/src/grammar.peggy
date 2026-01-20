// ABCT Grammar - A DSL for transforming ABC music notation
// Based on the spec at plans/9.abct-language-spec.md

{{
  // Helper to build left-associative binary expressions
  function buildBinaryLeft(head, tail, makeNode) {
    return tail.reduce((left, element) => makeNode(left, element), head);
  }
}}

// ============================================================================
// Program Structure
// ============================================================================

program
  = statements:statement* _ { return { type: "program", statements }; }

statement
  = _ a:assignment { return a; }
  / _ e:expr { return e; }

assignment
  = id:identifier _ "=" _ value:expr {
      return { type: "assignment", id, value };
    }

// ============================================================================
// Expression Hierarchy (lowest to highest precedence)
// ============================================================================

expr
  = pipeline

// Pipe operator: lowest precedence
pipeline
  = head:concat_term tail:(_ "|" !("=") _ concat_term)* {
      return buildBinaryLeft(head, tail.map(t => t[4]), (left, right) => ({
        type: "pipe",
        left,
        right
      }));
    }

// Concatenation: second lowest
concat_term
  = head:update_term tail:(_ "+" _ update_term)* {
      return buildBinaryLeft(head, tail.map(t => t[3]), (left, right) => ({
        type: "concat",
        left,
        right
      }));
    }

// Update operator: binds selector to single application
update_term
  = sel:(selector / location_selector) _ "|=" _ transform:application {
      return { type: "update", selector: sel, transform };
    }
  / application

// Selector: @ followed by selector path
selector
  = "@" path:selector_path { return { type: "selector", path }; }

// Application: one or more logical terms (function name + args)
// Whitespace separates terms in an application (no newlines - use ws not _)
application
  = head:logical tail:(ws logical)* {
      const terms = [head, ...tail.map(t => t[1])];
      return terms.length === 1
        ? terms[0]
        : { type: "application", terms };
    }

// ============================================================================
// Logical and Comparison Operators
// ============================================================================

logical
  = or_term

or_term
  = head:and_term tail:(_ "or" _ and_term)* {
      return buildBinaryLeft(head, tail.map(t => t[3]), (left, right) => ({
        type: "or",
        left,
        right
      }));
    }

and_term
  = head:not_term tail:(_ "and" _ not_term)* {
      return buildBinaryLeft(head, tail.map(t => t[3]), (left, right) => ({
        type: "and",
        left,
        right
      }));
    }

not_term
  = "not" _ operand:not_term { return { type: "not", operand }; }
  / comparison

comparison
  = left:atom _ op:cmp_op _ right:atom {
      return { type: "comparison", op, left, right };
    }
  / atom

cmp_op
  = ">=" { return ">="; }
  / "<=" { return "<="; }
  / "==" { return "=="; }
  / "!=" { return "!="; }
  / ">" { return ">"; }
  / "<" { return "<"; }

// ============================================================================
// Atoms
// ============================================================================

atom
  = "(" _ e:expr _ ")" { return e; }
  / "[" _ items:list_items? _ "]" {
      return { type: "list", items: items || [] };
    }
  / abc_literal
  / location_selector
  / selector
  / voice_ref
  / file_ref
  / n:number { return { type: "number", value: n }; }
  / id:identifier { return { type: "identifier", name: id }; }

// Location selector: :line or :line:col for piped input
location_selector
  = ":" loc:location {
      return { type: "location_selector", ...loc };
    }

// Voice reference: V:name or V:number (used in lists like distribute [V:S, V:A])
voice_ref
  = type:identifier ":" name:(identifier / integer) {
      return { type: "voice_ref", voiceType: type, name };
    }

// ============================================================================
// Compound Constructs
// ============================================================================

// File reference with optional location and selector
file_ref
  = p:path loc:(":" location)? sel:("@" selector_path)? {
      return {
        type: "file_ref",
        path: p,
        location: loc ? loc[1] : null,
        selector: sel ? sel[1] : null
      };
    }

// Selector path: identifier with optional sub-selector
// Note: range must come before number to match "5-8" before matching just "5"
selector_path
  = id:identifier ":" val:(identifier / range / number) {
      return { id, value: val };
    }
  / id:identifier { return { id }; }

// Location: line with optional column and range
location
  = line:line_num ":" col:col_num end:range_end? {
      return end ? { line, col, end } : { line, col };
    }
  / line:line_num { return { line }; }

range_end
  = "-" endLine:line_num ":" endCol:col_num {
      return { type: "multiline", endLine, endCol };
    }
  / "-" endCol:col_num {
      return { type: "singleline", endCol };
    }

// Range for selectors like @M:5-8
range
  = start:integer "-" end:integer {
      return { type: "range", start, end };
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
      return { type: "abc_literal", content };
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

// Identifier: starts with letter or underscore
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
