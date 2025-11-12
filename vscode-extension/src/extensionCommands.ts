import { ExtensionContext, Selection, TextEdit, commands, window } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { MIDIIn } from "./Midi/midi-in";

export type AbcTransformParams = {
  selection: Selection;
  uri: string;
};

/**
 * For now, transform commands are only for rhythms.
 * They include `abc.divideRhythm`, and
 * `abc.multiplyRhythm`.
 */
function registerTransformCommands(context: ExtensionContext, client: LanguageClient) {
  const commandsList = [
    ["abc.divideRhythm", "divideRhythm"],
    ["abc.multiplyRhythm", "multiplyRhythm"],
    ["abc.transposeUp", "transposeUp"],
    ["abc.transposeDn", "transposeDn"],
  ];
  commandsList.forEach(([cmdName, cmdMethod]) => {
    const disposable = commands.registerCommand(cmdName, async () => {
      const editor = window.activeTextEditor;
      if (editor) {
        // Get the selection range
        const selection = editor.selection;

        // Include the selection information in the parameters when triggering the command
        const params: AbcTransformParams = { selection, uri: editor.document.uri.toString() };
        // Send a custom request to the language server with the selection information
        const onResponse = (res: [TextEdit]) => {
          //apply text edit to the doc
          editor.edit((editBuilder) => {
            editBuilder.replace(selection, res[0].newText);
          });
        };
        const res = await client.sendRequest<[TextEdit]>(cmdMethod, params);
        onResponse(res);
      }
    });
    context.subscriptions.push(disposable);
  });
}

/**
 * This functionality is ripped from LilyPond's extension.
 * Allows for taking MIDI input and converting it to ABC notation.
 */
const registerMidiInputs = (context: ExtensionContext, client: LanguageClient) => {
  // start midi input
  const startInputMidiCmd = commands.registerCommand("abc.startMIDIInput", () => {
    MIDIIn.startMIDIInput();
  });
  context.subscriptions.push(startInputMidiCmd);

  // stop midi input
  const stopInputMidiCmd = commands.registerCommand("abc.stopMIDIInput", () => {
    MIDIIn.stopMIDIInput();
  });
  context.subscriptions.push(stopInputMidiCmd);

  // set midi input device
  const setInputMidiDeviceCmd = commands.registerCommand("abc.setInputMIDIDevice", () => {
    MIDIIn.setInputMIDIDevice();
  });
  context.subscriptions.push(setInputMidiDeviceCmd);

  // restart midi input
  const restartMIDIInputCmd = commands.registerCommand("abc.restartMIDIInput", () => {
    MIDIIn.restartMIDIInput();
  });
  context.subscriptions.push(restartMIDIInputCmd);

  // status bar items for MIDI playback
  MIDIIn.initMIDIStatusBarItems();
};

/**
 * Register the commands that the extension will use to ask the server to do special things.
 * Amongst the server's capabilities are transforming rhythms, and taking midi inputs.
 */
export function registerCommands(context: ExtensionContext, client: LanguageClient) {
  registerTransformCommands(context, client);
  registerMidiInputs(context, client);
}
