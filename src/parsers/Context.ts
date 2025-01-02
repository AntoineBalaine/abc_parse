import { AbcErrorReporter } from "./ErrorReporter";

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
    return (this.nextId++).toString();
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
  constructor(
    public errorReporter: AbcErrorReporter,
    public options: AbcContextOpts = {
      preserveComments: true,
      formatOptions: {
        alignBarlines: true,
      },
    },
  ) {
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
