{
  "targets": [
    {
      "target_name": "tree_sitter_abc_binding",
      "include_dirs": [
        "<!(node -e \"require('nan')\")",
        "src",
        "<!(pkg-config --cflags-only-I pcre2-8 2>/dev/null | sed 's/-I//g' || echo /usr/include)"
      ],
      "sources": [
        "bindings/node/binding.cc",
        "src/parser.c",
        "src/scanner.c"
      ],
      "cflags_c": ["-std=c99"],
      "cflags_cc": ["-std=c++14"],
      "libraries": [
        "<!(pkg-config --libs pcre2-8 2>/dev/null || echo -lpcre2-8)"
      ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "OTHER_CFLAGS": ["-std=c99"],
            "OTHER_CPLUSPLUSFLAGS": ["-std=c++14"]
          }
        }]
      ]
    }
  ]
}
