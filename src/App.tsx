/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Square,
  Terminal,
  Code as CodeIcon,
  Layers,
  BookOpen,
  Copy,
  RotateCcw,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Coffee,
  Sliders,
  ArrowRight,
  ChevronRight,
  FileCode,
  Sparkles,
  Info,
  Keyboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { JavaEngine, TerminalLine } from './utils/javaEngine';
import { JAVA_TEMPLATES, JavaTemplate } from './utils/javaTemplates';

export default function App() {
  // Navigation & Viewport State
  const [activeTab, setActiveTab] = useState<'editor' | 'terminal' | 'templates' | 'guide'>('editor');
  
  // Editor State
  const [code, setCode] = useState<string>(JAVA_TEMPLATES[0].code);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(JAVA_TEMPLATES[0].id);
  const [fontSize, setFontSize] = useState<number>(14);
  const [lineCount, setLineCount] = useState<number>(1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compiler / Run State
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { id: 'h1', type: 'header', text: '=== Offline Mobile Java Compiler ===' },
    { id: 'h2', type: 'system', text: 'Ready to compile. Press "[RUN CODE]" to execute.' }
  ]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isInputPending, setIsInputPending] = useState<boolean>(false);
  const [inputPlaceholder, setInputPlaceholder] = useState<string>('Enter scanner value...');
  const [currentInputVal, setCurrentInputVal] = useState<string>('');
  
  // Input Promise Holder (Crucial for blocking Java Scanner calls client-side!)
  const inputResolverRef = useRef<((value: string) => void) | null>(null);

  // Custom User Prompt Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Track the source line numbers inside the editor
  useEffect(() => {
    const lines = code.split('\n').length;
    setLineCount(lines || 1);
  }, [code]);

  // Clean prompt toast helper
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  // Keyboard Accessory Insert Helper (Increases Mobile Usability significantly)
  const handleInsertAccessory = (value: string) => {
    if (!textareaRef.current) return;
    const ref = textareaRef.current;
    const start = ref.selectionStart || 0;
    const end = ref.selectionEnd || 0;
    const textBefore = code.substring(0, start);
    const textAfter = code.substring(end);
    
    const newCode = textBefore + value + textAfter;
    setCode(newCode);

    // Reposition cursor right after the newly inserted snippet
    setTimeout(() => {
      ref.focus();
      const pos = start + value.length;
      ref.setSelectionRange(pos, pos);
    }, 50);

    showToast(`Inserted: ${value.trim()}`, 'info');
  };

  // Load selected boilerplate Java program
  const loadTemplate = (tpl: JavaTemplate) => {
    setCode(tpl.code);
    setSelectedTemplate(tpl.id);
    setActiveTab('editor');
    showToast(`Loaded: ${tpl.title}`, 'success');
  };

  // Clear Terminal Output
  const clearTerminal = () => {
    setTerminalLines([
      { id: Date.now().toString(), type: 'system', text: 'Console cleared.' }
    ]);
  };

  // Stop Execution immediately
  const handleStopExecution = () => {
    if (inputResolverRef.current) {
      // Resolve with empty string or cancel to unblock thread
      inputResolverRef.current('');
      inputResolverRef.current = null;
    }
    setIsRunning(false);
    setIsInputPending(false);
    setTerminalLines(prev => [
      ...prev,
      { id: Date.now().toString(), type: 'stderr', text: '\nProcess terminated by the user.' }
    ]);
    showToast('Execution Stopped', 'error');
  };

  // Run Compiler Task
  const handleRunCode = async () => {
    if (isRunning) return;

    setActiveTab('terminal');
    setIsRunning(true);
    setIsInputPending(false);
    
    setTerminalLines([
      { id: 'init', type: 'header', text: '=== Compiling & Running Java Program ===' },
      { id: 'status', type: 'system', text: 'Offline analysis started...' }
    ]);

    const startTime = performance.now();

    const appendToTerminal = (text: string, type: 'stdout' | 'stderr' | 'stdin' | 'system' = 'stdout') => {
      setTerminalLines(prev => {
        // If the last line is same type and doesn't end with a newline, let's append to it
        if (prev.length > 0 && prev[prev.length - 1].type === type && !prev[prev.length - 1].text.endsWith('\n') && type !== 'stdin') {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            text: updated[updated.length - 1].text + text
          };
          return updated;
        }
        return [
          ...prev,
          { id: Math.random().toString(), type, text }
        ];
      });
    };

    // Callback that is invoked when Java calls sc.nextInt() or sc.nextLine()
    const handleScannerRequest = (): Promise<string> => {
      setIsInputPending(true);
      return new Promise<string>((resolve) => {
        inputResolverRef.current = resolve;
      });
    };

    const engine = new JavaEngine(code, (txt) => appendToTerminal(txt, 'stdout'), handleScannerRequest);
    
    // Transpile step
    const transpileResult = engine.transpile();
    const transpileTime = (performance.now() - startTime).toFixed(1);

    if (!transpileResult.success || !transpileResult.transpiledCode) {
      setTerminalLines(prev => [
        ...prev,
        { id: 'err1', type: 'stderr', text: `\nJava Compiler Error:\n${transpileResult.error || 'Syntax verification failed'}` }
      ]);
      setIsRunning(false);
      return;
    }

    appendToTerminal(`Compiled successfully in ${transpileTime}ms.\nLaunching VM...\n\n`, 'system');

    try {
      await engine.execute(transpileResult.transpiledCode);
      const executionTotalTime = (performance.now() - startTime).toFixed(0);
      setTerminalLines(prev => [
        ...prev,
        { id: 'finish', type: 'system', text: `\n\n---\nProgram terminated successfully (Total time: ${executionTotalTime}ms).` }
      ]);
    } catch (err: any) {
      setTerminalLines(prev => [
        ...prev,
        { id: 'runtime-err', type: 'stderr', text: `\nException in thread "main" ${err.message || String(err)}` }
      ]);
    } finally {
      setIsRunning(false);
      setIsInputPending(false);
      inputResolverRef.current = null;
    }
  };

  // Submit Scanner Console input
  const handleSubmitInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isInputPending || !inputResolverRef.current) return;

    const submittedText = currentInputVal;
    
    // Write the typed input back to terminal out
    setTerminalLines(prev => [
      ...prev,
      { id: Math.random().toString(), type: 'stdin', text: submittedText + '\n' }
    ]);

    // Resolve the blocking scanner promise
    const resolveInput = inputResolverRef.current;
    inputResolverRef.current = null;
    setIsInputPending(false);
    setCurrentInputVal('');
    resolveInput(submittedText);
  };

  // Easy Quick Accessory Symbols for Quick Tap-Writing
  const accessoryBar = [
    { label: '{ }', value: ' {\n    \n}' },
    { label: ';', value: ';' },
    { label: 'System.out.println()', value: 'System.out.println("");' },
    { label: 'Scanner', value: 'Scanner sc = new Scanner(System.in);' },
    { label: 'sc.nextInt()', value: 'sc.nextInt()' },
    { label: 'sc.nextLine()', value: 'sc.nextLine()' },
    { label: 'Main Class', value: 'public class Main {\n    public static void main(String[] args) {\n        \n    }\n}' },
    { label: 'if', value: 'if ( ) {\n    \n}' },
    { label: 'for', value: 'for (int i = 0; i < 5; i++) {\n    \n}' },
    { label: 'while', value: 'while ( ) {\n    \n}' },
    { label: 'int', value: 'int ' },
    { label: 'double', value: 'double ' },
    { label: 'boolean', value: 'boolean ' },
    { label: 'String', value: 'String ' },
    { label: '( )', value: '()' },
    { label: '[ ]', value: '[]' },
    { label: '=', value: ' = ' },
    { label: '" "', value: '""' },
    { label: 'Tab', value: '    ' }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col antialiased select-none">
      
      {/* Toast Alert Banner */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border bg-slate-800 text-sm max-w-sm w-[90%]"
            style={{
              borderColor: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#ef4444' : '#38bdf8'
            }}
          >
            {toast.type === 'success' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" />}
            <span className="truncate">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Mobile Navbar */}
      <header className="sticky top-0 bg-slate-950 border-b border-slate-800 px-4 py-3 shrink-0 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-950/40">
            <Coffee className="w-5 h-5 text-amber-100" />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold tracking-tight text-white flex items-center gap-1">
              Java compiler offline
            </h1>
            <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              99.2% OFFLINE READY
            </p>
          </div>
        </div>

        {/* Action button inside header */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleStopExecution}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-md"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP</span>
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleRunCode}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer shadow-md shadow-sky-950/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>RUN CODE</span>
            </motion.button>
          )}
        </div>
      </header>

      {/* Primary Mobile Layout Swiper/Wrapper */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
        
        {/* Sub-Header view tabs for mobile navigation */}
        <div className="bg-slate-950 border-b border-slate-800/80 px-1 py-1 flex items-center justify-around font-medium select-none md:hidden shrink-0">
          <button
            onClick={() => setActiveTab('editor')}
            className={`flex-1 py-2 text-xs flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeTab === 'editor' ? 'text-sky-400 bg-slate-900/60 font-semibold' : 'text-slate-400 font-normal hover:text-slate-200'
            }`}
          >
            <CodeIcon className="w-4 h-4" />
            <span>Editor</span>
          </button>
          
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex-1 py-2 text-xs flex flex-col items-center gap-1 rounded-lg transition-all relative ${
              activeTab === 'terminal' ? 'text-sky-400 bg-slate-900/60 font-semibold' : 'text-slate-400 font-normal hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Console</span>
            {isInputPending && (
              <span className="absolute top-1 right-8 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 py-2 text-xs flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeTab === 'templates' ? 'text-sky-400 bg-slate-900/60 font-semibold' : 'text-slate-400 font-normal hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Templates</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2 text-xs flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeTab === 'guide' ? 'text-sky-400 bg-slate-900/60 font-semibold' : 'text-slate-400 font-normal hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Syntax Guide</span>
          </button>
        </div>

        {/* Lateral Sized Sidebar for Desktop/Tablet displays */}
        <div className="hidden md:flex w-72 border-r border-slate-800 bg-slate-950 flex-col shrink-0 overflow-y-auto">
          <div className="p-4 border-b border-slate-900">
            <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Java Projects Lab</h3>
          </div>
          
          {/* Templates load list inside sidebar */}
          <div className="p-3 space-y-2 flex-grow">
            {JAVA_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => loadTemplate(tpl)}
                className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between border ${
                  selectedTemplate === tpl.id 
                    ? 'bg-slate-900 border-sky-500/50 text-white' 
                    : 'bg-slate-950/40 border-transparent hover:bg-slate-900/50 text-slate-300'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold">{tpl.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{tpl.description}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/20 text-[11px] text-slate-400">
            <p className="font-semibold text-slate-200">How to use:</p>
            <ol className="list-decimal pl-4 mt-1 space-y-1">
              <li>Write standard Java class modules.</li>
              <li>Include public static void main method.</li>
              <li>Use standard java.util.Scanner for user prompts.</li>
              <li>Click RUN to execute offline in your browser.</li>
            </ol>
          </div>
        </div>

        {/* Active view screens wrapper */}
        <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-900">
          
          {/* EDITOR tab */}
          {(activeTab === 'editor' || window.innerWidth >= 768) && (
            <div className={`flex-grow overflow-hidden flex flex-col ${activeTab !== 'editor' ? 'hidden md:flex' : 'flex'}`}>
              
              {/* Editor controls */}
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-slate-300 flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded">
                    <FileCode className="w-3 h-3 text-orange-400" />
                    <span>MainClass.java</span>
                  </span>
                  
                  {/* Font resizing */}
                  <div className="flex items-center gap-1 bg-slate-800/60 rounded px-1.5 py-0.5">
                    <button 
                      onClick={() => setFontSize(Math.max(11, fontSize - 1))}
                      className="p-1 hover:text-white cursor-pointer active:scale-95"
                    >
                      A-
                    </button>
                    <span className="font-mono text-[10px] bg-slate-950 px-1 py-0.5 rounded">{fontSize}px</span>
                    <button 
                      onClick={() => setFontSize(Math.min(22, fontSize + 1))}
                      className="p-1 hover:text-white cursor-pointer active:scale-95"
                    >
                      A+
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(code);
                      showToast('Java code copied to clipboard!', 'success');
                    }}
                    className="p-1.5 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded transition-colors flex items-center gap-1 cursor-pointer"
                    title="Copy code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Copy</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      if (window.confirm('Reset code to the current template default?')) {
                        const original = JAVA_TEMPLATES.find(t => t.id === selectedTemplate) || JAVA_TEMPLATES[0];
                        setCode(original.code);
                        showToast('Editor reset successfully', 'success');
                      }
                    }}
                    className="p-1.5 hover:text-red-400 bg-slate-800/80 hover:bg-slate-800 rounded transition-colors flex items-center gap-1 cursor-pointer"
                    title="Reset template"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                </div>
              </div>

              {/* Text Writing Body */}
              <div className="flex-grow flex overflow-hidden relative font-mono">
                {/* Visual Line numbers */}
                <div className="w-10 bg-slate-950/40 select-none py-3 text-right text-slate-600 pr-2 border-r border-slate-800/60 text-xs leading-5">
                  {Array.from({ length: lineCount }).map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>

                {/* Main Textarea */}
                <textarea
                  id="java-editor-area"
                  ref={textareaRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 bg-transparent p-3 outline-none text-slate-100 placeholder-slate-600 resize-none overflow-y-auto leading-5"
                  style={{ fontSize: `${fontSize}px` }}
                  placeholder="// Enter your Java code here"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>

              {/* Speed typing Accessory Toolbar (Horizontal scroll layout) */}
              <div className="bg-slate-950 border-t border-slate-800 px-2 py-1.5 shrink-0 flex items-center gap-1.5 overflow-x-auto select-none no-scrollbar">
                <div className="flex items-center shrink-0 pr-1 border-r border-slate-800/80">
                  <Keyboard className="w-3.5 h-3.5 text-sky-400 mr-1.5" />
                  <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">QUICK</span>
                </div>
                {accessoryBar.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleInsertAccessory(item.value)}
                    className="px-2.5 py-1 text-xs font-mono font-bold bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TERMINAL tab */}
          {(activeTab === 'terminal' || window.innerWidth >= 1024) && (
            <div className={`flex flex-col bg-slate-950 border-t lg:border-t-0 border-slate-800 ${
              activeTab !== 'terminal' ? 'hidden lg:flex' : 'flex'
            } ${window.innerWidth >= 768 ? 'md:h-64 lg:h-full lg:w-96 lg:border-l' : 'flex-grow'}`}>
              
              {/* Terminal header control */}
              <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-bold text-white uppercase tracking-wider text-[11px]">System terminal console</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={clearTerminal}
                    className="p-1 hover:text-white rounded flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-slate-500 hover:text-red-400" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Terminal lines output list */}
              <div className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-5 bg-slate-950 flex flex-col gap-1 select-text">
                {terminalLines.map((line) => {
                  let lineClass = 'text-slate-300';
                  if (line.type === 'stderr') lineClass = 'text-red-400 whitespace-pre-wrap font-semibold border-l-2 border-red-500 pl-2 bg-red-950/10 py-1';
                  if (line.type === 'system') lineClass = 'text-indigo-400 font-medium italic';
                  if (line.type === 'stdin') lineClass = 'text-yellow-300 font-bold';
                  if (line.type === 'header') lineClass = 'text-sky-400 font-bold border-b border-slate-800/80 pb-1 mb-1';

                  return (
                    <div key={line.id} className={`${lineClass} whitespace-pre-wrap break-words`}>
                      {line.text}
                    </div>
                  );
                })}

                {/* Pending Input prompt indication line inside terminal */}
                {isInputPending && (
                  <div className="text-yellow-400 flex items-center gap-2 bg-yellow-950/10 border border-yellow-700/20 px-3 py-2 rounded-lg mt-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping shrink-0" />
                    <div>
                      <span className="font-bold">Scanner.in pending:</span> Enter integer or text value below.
                    </div>
                  </div>
                )}
              </div>

              {/* Scanner prompt submit input footer */}
              {isInputPending && (
                <form
                  onSubmit={handleSubmitInput}
                  className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0 animate-pulse-slow"
                >
                  <span className="text-xs text-yellow-400 font-bold shrink-0">Scanner IN:</span>
                  <input
                    type="text"
                    value={currentInputVal}
                    onChange={(e) => setCurrentInputVal(e.target.value)}
                    className="flex-1 bg-slate-950 rounded-lg px-3 py-2 text-xs font-mono outline-none text-yellow-300 placeholder-slate-600 border border-yellow-600/30 focus:border-yellow-500 transition-colors"
                    placeholder="Type scanner input and click Send"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-yellow-500 hover:bg-yellow-400 text-slate-950 text-xs font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <span>Send</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TEMPLATES list list */}
          {activeTab === 'templates' && (
            <div className="flex-grow p-4 overflow-y-auto md:hidden">
              <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
                <span>Prebuilt Templates Library</span>
              </h2>
              
              <div className="grid grid-cols-1 gap-3">
                {JAVA_TEMPLATES.map((tpl) => (
                  <div
                    key={tpl.id}
                    onClick={() => loadTemplate(tpl)}
                    className={`p-4 rounded-2xl transition-all cursor-pointer border flex flex-col gap-2 ${
                      selectedTemplate === tpl.id
                        ? 'bg-slate-800 border-sky-400 text-white'
                        : 'bg-slate-950/60 hover:bg-slate-900/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] uppercase tracking-wide font-extrabold px-2 py-0.5 rounded-full ${
                        tpl.difficulty === 'Beginner' ? 'bg-emerald-500/20 text-emerald-400' :
                        tpl.difficulty === 'Intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {tpl.difficulty}
                      </span>
                      {selectedTemplate === tpl.id && <span className="text-[10px] text-sky-400 font-bold">&#10003; ACTIVE</span>}
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white">{tpl.title}</h4>
                      <p className="text-xs text-slate-400 mt-1">{tpl.description}</p>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono mt-1 border-t border-slate-800/20 pt-2 flex items-center justify-between">
                      <span>Click to load boilerplate...</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CHEAT SHEET / GUIDES tab */}
          {activeTab === 'guide' && (
            <div className="flex-grow p-4 overflow-y-auto">
              <h2 className="text-sm font-semibold tracking-wider text-slate-400 uppercase mb-4 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Java Programming Reference</span>
              </h2>

              <div className="space-y-4 text-xs">
                {/* 1. Primitives Data Types */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                  <h3 className="font-bold text-white border-b border-slate-800/80 pb-1.5 mb-2 flex items-center gap-1 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span>Primitive Data Types</span>
                  </h3>
                  <div className="font-mono text-slate-300 space-y-1">
                    <p><span className="text-sky-400">int</span> score = 100;</p>
                    <p><span className="text-sky-400">double</span> price = 19.99;</p>
                    <p><span className="text-sky-400">boolean</span> isActive = <span className="text-orange-400">true</span>;</p>
                    <p><span className="text-sky-400">char</span> grade = &apos;A&apos;;</p>
                    <p><span className="text-sky-400">String</span> name = &quot;Ander&quot;;</p>
                  </div>
                </div>

                {/* 2. Standard Conditions */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                  <h3 className="font-bold text-white border-b border-slate-800/80 pb-1.5 mb-2 flex items-center gap-1 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span>If-Else Conditions</span>
                  </h3>
                  <div className="font-mono text-slate-300 text-[11px] leading-5">
                    <p><span className="text-purple-400">if</span> (score &gt;= 90) &#123;</p>
                    <p className="pl-4">System.out.println(&quot;Grade A&quot;);</p>
                    <p>&#125; <span className="text-purple-400">else if</span> (score &gt;= 70) &#123;</p>
                    <p className="pl-4">System.out.println(&quot;Grade B&quot;);</p>
                    <p>&#125; <span className="text-purple-400">else</span> &#123;</p>
                    <p className="pl-4">System.out.println(&quot;Grade F&quot;);</p>
                    <p>&#125;</p>
                  </div>
                </div>

                {/* 3. For/While loops */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                  <h3 className="font-bold text-white border-b border-slate-800/80 pb-1.5 mb-2 flex items-center gap-1 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span>Iteration Loops</span>
                  </h3>
                  <div className="font-mono text-slate-300 text-[11px] leading-5 space-y-2">
                    <div>
                      <p className="text-slate-500">// Standard For Loop</p>
                      <p><span className="text-purple-400">for</span> (<span className="text-sky-400">int</span> i = 0; i &lt; 5; i++) &#123;</p>
                      <p className="pl-4">System.out.println(i);</p>
                      <p>&#125;</p>
                    </div>
                    <div>
                      <p className="text-slate-500">// Standard While Loop</p>
                      <p><span className="text-sky-400">int</span> count = 0;</p>
                      <p><span className="text-purple-400">while</span> (count &lt; 3) &#123;</p>
                      <p className="pl-4">System.out.println(count);</p>
                      <p className="pl-4">count++;</p>
                      <p>&#125;</p>
                    </div>
                  </div>
                </div>

                {/* 4. Scanner inputs */}
                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
                  <h3 className="font-bold text-white border-b border-slate-800/80 pb-1.5 mb-2 flex items-center gap-1 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                    <span>Handling Console Inputs (Scanner)</span>
                  </h3>
                  <div className="font-mono text-slate-300 text-[11px] leading-5">
                    <p className="text-slate-500">// 1. Import or create scanner</p>
                    <p>Scanner sc = <span className="text-purple-400">new</span> Scanner(System.in);</p>
                    <p className="text-slate-500 mt-2">// 2. Read typed parameters</p>
                    <p><span className="text-sky-400">int</span> num = sc.nextInt();</p>
                    <p><span className="text-sky-400">String</span> line = sc.nextLine();</p>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
