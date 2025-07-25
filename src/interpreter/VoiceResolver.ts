import { Staff, VoiceElement, MusicLine } from "../../abcjs-ast";
import { InterpreterContext, VoiceContext } from "./InterpreterContext";
import { System } from "../types/Expr2";
import { Rational, createRational, addRational, compareRational } from "../Visitors/fmt2/rational";

export interface VoiceTiming {
  voiceId: string;
  currentTime: Rational; // Current time position in the voice
  elements: VoiceElement[];
}

export interface ResolvedSystem {
  staffs: Staff[];
  maxTime: Rational; // Total duration of the longest voice
}

/**
 * Resolves multi-voice structures following the rule: one voice = one staff
 */
export function resolveVoices(ctx: InterpreterContext, systems: System[]): MusicLine[] {
  const resolvedLines: MusicLine[] = [];
  
  for (const system of systems) {
    const resolved = resolveSystem(ctx, system);
    if (resolved.staffs.length > 0) {
      resolvedLines.push({ staff: resolved.staffs });
    }
  }
  
  return resolvedLines;
}

/**
 * Resolve a single system (line of music) handling multiple voices
 * Rule: one voice = one staff
 */
export function resolveSystem(ctx: InterpreterContext, system: System): ResolvedSystem {
  // Group elements by voice
  const voiceGroups = groupElementsByVoice(ctx, system);
  
  // Create one staff per voice
  const staffs: Staff[] = [];
  let maxTime = createRational(0);
  
  for (const group of voiceGroups) {
    const staff = createStaffForVoice(ctx, group);
    if (staff) {
      staffs.push(staff);
      
      // Calculate timing for this voice
      const voiceTime = calculateVoiceTime(group.elements);
      if (compareRational(voiceTime, maxTime) > 0) {
        maxTime = voiceTime;
      }
    }
  }
  
  return { staffs, maxTime };
}

/**
 * Group system elements by voice, handling voice switches
 */
function groupElementsByVoice(ctx: InterpreterContext, system: System): Array<{ voiceId: string; elements: any[] }> {
  const groups: Array<{ voiceId: string; elements: any[] }> = [];
  let currentVoiceId = ctx.currentVoiceId || getDefaultVoiceId(ctx);
  let currentGroup: any[] = [];
  
  for (const element of system) {
    // Check if this is a voice switch
    if (isVoiceSwitch(element)) {
      // Save current group if it has elements
      if (currentGroup.length > 0) {
        groups.push({ voiceId: currentVoiceId, elements: currentGroup });
        currentGroup = [];
      }
      
      // Switch to new voice
      const newVoiceId = extractVoiceId(element);
      if (newVoiceId) {
        currentVoiceId = newVoiceId;
      }
    } else {
      // Add element to current group
      currentGroup.push(element);
    }
  }
  
  // Add final group
  if (currentGroup.length > 0) {
    groups.push({ voiceId: currentVoiceId, elements: currentGroup });
  }
  
  return groups;
}

/**
 * Create a single staff for a single voice
 */
function createStaffForVoice(ctx: InterpreterContext, group: { voiceId: string; elements: any[] }): Staff | null {
  const voice = ctx.voices.get(group.voiceId);
  if (!voice) {
    console.warn(`Voice ${group.voiceId} not found in context`);
    return null;
  }
  
  // Convert elements to voice elements
  const voiceElements: VoiceElement[] = group.elements
    .map(element => convertToVoiceElement(element))
    .filter((element): element is VoiceElement => element !== null);
  
  const staff: Staff = {
    clef: voice.currentClef,
    key: voice.currentKey,
    meter: voice.currentMeter,
    workingClef: voice.currentClef,
    voices: [voiceElements], // Single voice in array
    title: voice.properties.name ? [voice.properties.name] : [voice.id]
  };
  
  return staff;
}

/**
 * Convert an element to a VoiceElement (placeholder implementation)
 */
function convertToVoiceElement(element: any): VoiceElement | null {
  // This would be implemented based on your element types
  // For now, just return the element if it looks like a VoiceElement
  if (element && element.el_type) {
    return element as VoiceElement;
  }
  return null;
}

/**
 * Calculate total time for a voice using Rational arithmetic
 */
function calculateVoiceTime(elements: any[]): Rational {
  let totalTime = createRational(0);
  
  for (const element of elements) {
    const duration = getElementDuration(element);
    if (duration) {
      totalTime = addRational(totalTime, duration);
    }
  }
  
  return totalTime;
}

/**
 * Get the rational duration of an element
 */
function getElementDuration(element: any): Rational | null {
  if (element && element.duration) {
    // If duration is already a Rational, return it
    if (typeof element.duration === 'object' && 'numerator' in element.duration) {
      return element.duration as Rational;
    }
    // If duration is a number, convert to Rational
    if (typeof element.duration === 'number') {
      return createRational(element.duration * 1000, 1000); // Convert to fraction
    }
  }
  return null;
}

/**
 * Check if an element represents a voice switch
 */
function isVoiceSwitch(element: any): boolean {
  // Check if this is a V: info line
  return element && 
         element.key && 
         element.key.lexeme === 'V';
}

/**
 * Extract voice ID from a voice switch element
 */
function extractVoiceId(element: any): string | null {
  if (isVoiceSwitch(element)) {
    // Extract voice ID from V: line
    if (element.value && element.value.length > 0) {
      return element.value[0].lexeme;
    }
  }
  return null;
}

/**
 * Get default voice ID from context
 */
function getDefaultVoiceId(ctx: InterpreterContext): string {
  if (ctx.voices.size > 0) {
    return ctx.voices.keys().next().value;
  }
  return "default";
}

/**
 * Handle voice overlays (& symbols) within a single voice
 */
export function resolveVoiceOverlays(elements: VoiceElement[]): VoiceElement[][] {
  const voices: VoiceElement[][] = [];
  let currentVoice: VoiceElement[] = [];
  
  for (const element of elements) {
    if (element.el_type === 'overlay') {
      // Start new voice overlay within the same staff
      if (currentVoice.length > 0) {
        voices.push(currentVoice);
        currentVoice = [];
      }
    } else {
      currentVoice.push(element);
    }
  }
  
  // Add final voice
  if (currentVoice.length > 0) {
    voices.push(currentVoice);
  }
  
  return voices.length > 0 ? voices : [[]];
}

/**
 * Calculate timing positions for elements in a voice
 */
export function calculateTimingPositions(ctx: InterpreterContext, elements: VoiceElement[]): Array<{ element: VoiceElement; startTime: Rational; endTime: Rational }> {
  const timedElements: Array<{ element: VoiceElement; startTime: Rational; endTime: Rational }> = [];
  let currentTime = createRational(0);
  
  for (const element of elements) {
    const duration = getElementDuration(element) || createRational(0);
    const endTime = addRational(currentTime, duration);
    
    timedElements.push({
      element,
      startTime: currentTime,
      endTime
    });
    
    currentTime = endTime;
  }
  
  return timedElements;
}