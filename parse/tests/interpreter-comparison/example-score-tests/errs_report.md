=== Semantic Analyzer Test Summary ===
Total files processed: 806
Passing: 797
Failing: 9
Semantic Analyzer errors: 9

Failed files:
  - all/percmap.abc
  - print/multi-stave-multi-page.abc
  - visual/abcplus_header_and_footer.abc
  - visual/fonts.abc
  - visual/header_and_footer.abc
  - visual/header_default_scale.abc
  - visual/header_scale_1.abc
  - visual/header_scale_125.abc
  - visual/header_scale_75.abc
    1) should successfully analyze all example files without hanging


  0 passing (528ms)
  1 failing

Error Details:
  [40/806] all/percmap.abc
    ERROR: Not implemented
  [126/806] print/multi-stave-multi-page.abc
    ERROR: Cannot read properties of undefined (reading 'toLowerCase')
  [485/806] visual/abcplus_header_and_footer.abc
    ERROR: Not implemented
  [568/806] visual/fonts.abc
    ERROR: Not implemented
  [581/806] visual/header_and_footer.abc
    ERROR: Not implemented
  [582/806] visual/header_default_scale.abc
    ERROR: Not implemented
  [583/806] visual/header_scale_1.abc
    ERROR: Not implemented
  [584/806] visual/header_scale_125.abc
    ERROR: Not implemented
  [585/806] visual/header_scale_75.abc
    ERROR: Not implemented

=== Interpreter Test Summary ===
Total files processed: 806
Passing: 790
Failing: 16
Interpreter errors: 16

Failed files:
  - all/percmap.abc
  - print/multi-stave-multi-page.abc
  - selection/selection-test.abc
  - visual/Bethany.abc
  - visual/LaMourisque_1.abc
  - visual/MilleRegretz_1.abc
  - visual/abcplus_header_and_footer.abc
  - visual/all-element-types.abc
  - visual/fonts.abc
  - visual/header_and_footer.abc
  - visual/header_default_scale.abc
  - visual/header_scale_1.abc
  - visual/header_scale_125.abc
  - visual/header_scale_75.abc
  - visual/phil_taylor13.abc
  - visual/slurs_errors_and_combo.abc
    1) should successfully interpret all example files without hanging


  0 passing (625ms)
  1 failing

  1) Pipeline Diagnostics - Interpreter
       should successfully interpret all example files without hanging:
     Error: 16 files failed interpretation
      at Context.<anonymous> (tests/interpreter-comparison/pipeline-diagnostics.interpreter.spec.ts:124:13)
      at processImmediate (node:internal/timers:491:21)

Error Details:
  [40/806] all/percmap.abc
    ERROR: Not implemented
  [126/806] print/multi-stave-multi-page.abc
    ERROR: Cannot read properties of undefined (reading 'toLowerCase')
  [127/806] selection/selection-test.abc
    ERROR: Cannot read properties of undefined (reading 'staff')
  [172/806] visual/Bethany.abc
    ERROR: Cannot read properties of undefined (reading 'staff')
  [324/806] visual/LaMourisque_1.abc
    ERROR: Cannot read properties of undefined (reading 'staff')
  [336/806] visual/MilleRegretz_1.abc
    ERROR: Cannot read properties of undefined (reading 'staff')
  [485/806] visual/abcplus_header_and_footer.abc
    ERROR: Not implemented
  [499/806] visual/all-element-types.abc
    ERROR: Cannot read properties of undefined (reading 'staff')
  [568/806] visual/fonts.abc
    ERROR: Not implemented
  [581/806] visual/header_and_footer.abc
    ERROR: Not implemented
  [582/806] visual/header_default_scale.abc
    ERROR: Not implemented
  [583/806] visual/header_scale_1.abc
    ERROR: Not implemented
  [584/806] visual/header_scale_125.abc
    ERROR: Not implemented
  [585/806] visual/header_scale_75.abc
    ERROR: Not implemented
  [638/806] visual/phil_taylor13.abc
    ERROR: Cannot read properties of undefined (reading 'staff')
  [702/806] visual/slurs_errors_and_combo.abc
    ERROR: Cannot read properties of undefined (reading 'staff')
