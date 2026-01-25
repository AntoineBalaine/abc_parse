import { ExtensionContext, commands } from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { MIDIIn } from "./Midi/midi-in";

/**
 * This functionality is ripped from LilyPond's extension.
 * Allows for taking MIDI input and converting it to ABC notation.
 */
const registerMidiInputs = (context: ExtensionContext) => {
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
 * The old transform commands (divideRhythm, multiplyRhythm, transposeUp, transposeDn) have been
 * replaced by the new abct2-based transform commands in transformCommands.ts.
 */
export function registerCommands(context: ExtensionContext, client: LanguageClient) {
  registerMidiInputs(context);
}
