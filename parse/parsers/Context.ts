import { AbcErrorReporter } from "./ErrorReporter";
import { FormatterConfig, DEFAULT_FORMATTER_CONFIG } from "../types/Expr2";

class IdGenerator {
  private static instance: IdGenerator;
  private nextId = 0;

  static getInstance() {
    if (!IdGenerator.instance) {
      IdGenerator.instance = new IdGenerator();
    }
    return IdGenerator.instance;
  }

  generate() {
    return this.nextId++;
  }
}

type AbcContextOpts = {
  /** not implemented */
  preserveComments: boolean;
  formatOptions: {
    /* not implemented */
    alignBarlines: boolean;
  };
};
/**
 * Context that’s shared between the scanner, parser, and formatter.
 * Includes ErrorReporting, token/parseTreeNodes’ idGenerator
 */
export class ABCContext {
  public errorReporter: AbcErrorReporter;
  /** File-level linear flag from %%linear in file header */
  public linear: boolean = false;
  /** Current tune's effective linear value. Inherits from file header, can be overridden in tune header. */
  public tuneLinear: boolean = false;
  /** File-level formatter config from %%abcls-fmt in file header */
  public formatterConfig: FormatterConfig = { ...DEFAULT_FORMATTER_CONFIG };
  /** Current tune's effective formatter config. Inherits from file header, can be overridden in tune header. */
  public tuneFormatterConfig: FormatterConfig = { ...DEFAULT_FORMATTER_CONFIG };
  constructor(
    errorReporter?: AbcErrorReporter,
    public options: AbcContextOpts = {
      preserveComments: true,
      formatOptions: {
        alignBarlines: true,
      },
    }
  ) {
    if (!errorReporter) {
      this.errorReporter = new AbcErrorReporter();
    } else {
      this.errorReporter = errorReporter;
    }
    this.idGenerator = new IdGenerator();
  }

  private idGenerator: IdGenerator;
  generateId() {
    return this.idGenerator.generate();
  }
}
/*
Possible future additions:

1. Configuration/Options:
```typescript
interface CompilerOptions {
    sourceMap: boolean;
    strictMode: boolean;
    target: 'development' | 'production';
}
```

2. Source Management:
```typescript
class CompilationContext {
    sourceFiles: Map<string, string>;
    currentFile: string;
    sourceMap?: SourceMap;
}
```

3. Symbol Tables/Scope:
```typescript
class CompilationContext {
    symbolTable: SymbolTable;
    currentScope: Scope;
}
```

4. Performance Monitoring:
```typescript
class CompilationContext {
    statistics: {
        startTime: number;
        nodeCount: number;
        errorCount: number;
    };
    diagnostics: DiagnosticsCollector;
}
```

5. Caching:
```typescript
class CompilationContext {
    astCache: Map<string, Node>;
    tokenCache: Map<string, Token[]>;
}
```
*/
