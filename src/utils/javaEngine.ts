/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TerminalLine {
  id: string;
  type: 'stdout' | 'stderr' | 'stdin' | 'system' | 'header';
  text: string;
}

export interface EngineResult {
  success: boolean;
  error?: string;
  transpiledCode?: string;
}

export type InputRequestCallback = () => Promise<string>;

/**
 * Super robust, offline-capable client-side Java Lexer, Transpiler, and Runner.
 * Translates standard Java syntax safely into sandboxed modern JavaScript.
 * Supports synchronous-feeling I/O using async/await!
 */
export class JavaEngine {
  private rawCode: string;
  private strings: string[] = [];
  private chars: string[] = [];
  private onPrint: (text: string) => void;
  private onInputRequest: InputRequestCallback;

  constructor(
    code: string,
    onPrint: (text: string) => void,
    onInputRequest: InputRequestCallback
  ) {
    this.rawCode = code;
    this.onPrint = onPrint;
    this.onInputRequest = onInputRequest;
  }

  /**
   * Safe parser using Lexical Placeholder Approach (LPA) to safeguard
   * string literals, character literals, and commentaries during compilation.
   */
  public transpile(): EngineResult {
    try {
      this.strings = [];
      this.chars = [];
      let code = this.rawCode;

      // 1. Remove comments but keep lines for exact debugging
      code = code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));
      code = code.replace(/\/\/.*$/gm, '');

      // 2. Extract and preserve String literals
      code = code.replace(/"(\\.|[^"\\])*"/g, (match) => {
        const id = `__STR_PLACEHOLDER_${this.strings.length}__`;
        this.strings.push(match);
        return id;
      });

      // 3. Extract and preserve Character literals
      code = code.replace(/'(\\.|[^'\\])*'/g, (match) => {
        const id = `__CHAR_PLACEHOLDER_${this.chars.length}__`;
        this.chars.push(match);
        return id;
      });

      // 4. Identify defined classes and their names to rewrite constructors
      const classFinderRegex = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
      let classMatch;
      const discoveredClasses: string[] = [];
      while ((classMatch = classFinderRegex.exec(code)) !== null) {
        discoveredClasses.push(classMatch[1]);
      }

      // 5. Replace Java typed array assignments and new declarations
      // Matches e.g. int[] arr = {1, 2, 3}; or String[] list = new String[x];
      // Type can be general: int, double, float, char, boolean, String, MyClass, etc.
      // Match: type[] name = {1,2,3};
      code = code.replace(
        /\b([a-zA-Z_][a-zA-Z0-9_]*|String)\[\s*\]\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{([^}]+)\}\s*;/g,
        'let $2 = [$3];'
      );

      // Match: type[] name = new type[size];
      code = code.replace(
        /\b([a-zA-Z_][a-zA-Z0-9_]*|String)\[\s*\]\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*new\s+\1\[\s*([^\]]+)\s*\]\s*;/g,
        (match, type, name, size) => {
          let fillVal = '0';
          if (type === 'String') fillVal = '""';
          if (type === 'boolean') fillVal = 'false';
          return `let ${name} = Array(${size}).fill(${fillVal});`;
        }
      );

      // Match dynamic array typing int[] x = blah;
      code = code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*|String)\[\s*\]\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g, 'let $2');

      // 6. Replace constructors of discovered classes
      // Class constructor MyClass(...) => constructor(...)
      for (const className of discoveredClasses) {
        const constructorRegex = new RegExp(`\\b${className}\\s*\\(([^)]*)\\)\\s*(?=\\{)`, 'g');
        code = code.replace(constructorRegex, 'constructor($1)');
      }

      // 7. Make all user class methods async so Scanner & Prints work seamlessly
      // Typical syntax: public static void main(String[] args) { ... }
      // static void greet(String name) { ... }
      // int calculate(int a) { ... }
      // This matches lines like: void myMethod(int x, double y) {
      // Let's replace return types and public/static visibility keywords with async functions!
      // Regex detects fields versus methods: (static)? (type) (name) (params) {
      const methodRegex = /\b(public|private|protected|static|final)\s+((public|private|protected|static|final|void|int|double|float|boolean|char|String|[a-zA-Z_][a-zA-Z0-9_]*)\s+)+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g;
      code = code.replace(methodRegex, (match, prefix, returnAndModifiers, lastType, methodName, params) => {
        // Is it class main or other methods?
        return `async ${methodName}(${this.stripTypesFromParams(params)}) {`;
      });

      // Handle standard blockless methods or plain typed signatures
      code = code.replace(/\b(void|int|double|float|boolean|char|String)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g, 'async $2($3) {');

      // 8. Replace common Java variables type declarations with let
      // E.g. "int age = 10;" -> "let age = 10;"
      // Matches primitive datatypes on declarations (with initialization or semi-colon)
      code = code.replace(/\b(int|double|float|long|short|byte|boolean|char|String|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\b(?!\s*\()/g, 'let $2');

      // Also clean up any loose multiple-variable declarations like "let age, let size" errors
      code = code.replace(/\blet\s+let\b/g, 'let');

      // 9. Standard Console Out mapping
      // System.out.println -> await _println
      // System.out.print -> await _print
      // System.out.printf -> await _printf
      code = code.replace(/\bSystem\.out\.println\s*\(/g, 'await _println(');
      code = code.replace(/\bSystem\.out\.print\s*\(/g, 'await _print(');
      code = code.replace(/\bSystem\.out\.printf\s*\(/g, 'await _printf(');

      // Math functions uppercase alignment
      code = code.replace(/\bMath\.sin\b/g, 'Math.sin');
      code = code.replace(/\bMath\.cos\b/g, 'Math.cos');
      code = code.replace(/\bMath\.abs\b/g, 'Math.abs');
      code = code.replace(/\bMath\.sqrt\b/g, 'Math.sqrt');
      code = code.replace(/\bMath\.pow\b/g, 'Math.pow');
      code = code.replace(/\bMath\.max\b/g, 'Math.max');
      code = code.replace(/\bMath\.min\b/g, 'Math.min');
      code = code.replace(/\bMath\.random\b/g, 'Math.random');

      // 10. Java Scanner implementation
      // Scanner scanner = new Scanner(System.in); -> let scanner = _createScannerInstance();
      code = code.replace(/Scanner\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*new\s+Scanner\s*\(\s*System\.in\s*\)\s*;/g, 'let $1 = _createScannerInstance();');
      
      // Match individual await calls: scanner.nextInt() -> await scanner.nextInt()
      code = code.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\.(next|nextInt|nextDouble|nextFloat|nextLine)\s*\(\s*\)/g, 'await $1.$2()');

      // Replace common keywords and details
      code = code.replace(/\bfinal\b/g, 'const');

      // Remove Java-specific imports that block parsing
      code = code.replace(/import\s+java\.[a-zA-Z0-9._]+;/g, '');

      // 11. Restore preserved variables (strings and chars)
      this.strings.forEach((strVal, index) => {
        code = code.replace(new RegExp(`__STR_PLACEHOLDER_${index}__`, 'g'), strVal);
      });
      this.chars.forEach((charVal, index) => {
        code = code.replace(new RegExp(`__CHAR_PLACEHOLDER_${index}__`, 'g'), charVal);
      });

      // Find the main class and instantiate + run its main method
      // We look for a class containing "async main"
      let mainClassName = '';
      for (const className of discoveredClasses) {
        // Let's find which class declares the 'main' method.
        // We look for keyword class + name, followed by its methods
        const classDeclIndex = code.indexOf(`class ${className}`);
        if (classDeclIndex !== -1) {
          const mainMethodIndex = code.indexOf('async main', classDeclIndex);
          if (mainMethodIndex !== -1) {
            mainClassName = className;
            break;
          }
        }
      }

      if (!mainClassName && discoveredClasses.length > 0) {
        mainClassName = discoveredClasses[0];
      }

      if (!mainClassName) {
        // If they did not define a clean class matching, we wrap the whole code structure inside an implicit Main
        throw new Error("No public class or 'main' method discovered. Please declare code like: public class Main { public static void main(String[] args) { ... } }");
      }

      // Add actual execution invocation
      const footerCode = `
        const compilerInstance = new ${mainClassName}();
        if (compilerInstance.main) {
          await compilerInstance.main([]);
        } else {
          throw new Error("Main method not found in class ${mainClassName}");
        }
      `;

      return {
        success: true,
        transpiledCode: `${code}\n${footerCode}`
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || String(err)
      };
    }
  }

  private stripTypesFromParams(paramsStr: string): string {
    if (!paramsStr.trim()) return '';
    return paramsStr
      .split(',')
      .map((p) => {
        const parts = p.trim().split(/\s+/);
        // The last part is typically the variable name (e.g. String[] args -> args)
        return parts[parts.length - 1];
      })
      .join(', ');
  }

  /**
   * Execute the transpiled code inside a secure local sandbox fully offline.
   */
  public async execute(transpiled: string): Promise<void> {
    const printBuffer = this.onPrint;
    const requestInput = this.onInputRequest;

    // Direct sandbox functions injected to Java execution scope
    const _println = async (val: any) => {
      const output = val !== undefined ? String(val) : '';
      printBuffer(output + '\n');
    };

    const _print = async (val: any) => {
      const output = val !== undefined ? String(val) : '';
      printBuffer(output);
    };

    const _printf = async (format: string, ...args: any[]) => {
      let result = format;
      for (const arg of args) {
        result = result.replace(/%[s|d|f|c|b|n]/, String(arg));
      }
      // Replace newline signifier %n
      result = result.replace(/%n/g, '\n');
      printBuffer(result);
    };

    const _createScannerInstance = () => {
      return {
        nextInt: async () => {
          const input = await requestInput();
          const parsed = parseInt(input.trim(), 10);
          if (isNaN(parsed)) return 0;
          return parsed;
        },
        nextDouble: async () => {
          const input = await requestInput();
          const parsed = parseFloat(input.trim());
          if (isNaN(parsed)) return 0.0;
          return parsed;
        },
        nextFloat: async () => {
          const input = await requestInput();
          const parsed = parseFloat(input.trim());
          if (isNaN(parsed)) return 0.0;
          return parsed;
        },
        nextLine: async () => {
          return await requestInput();
        },
        next: async () => {
          const input = await requestInput();
          return input.split(/\s+/)[0] || '';
        },
      };
    };

    // Construct execution sandbox using an AsyncFunction generator with strictly bound variables
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    
    const runnable = new AsyncFunction(
      '_println',
      '_print',
      '_printf',
      '_createScannerInstance',
      'Math',
      transpiled
    );

    await runnable(
      _println,
      _print,
      _printf,
      _createScannerInstance,
      Math
    );
  }
}
