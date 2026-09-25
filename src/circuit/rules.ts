/**
 * Circuit validation rules for LabLens (R1 to R8).
 * Derived strictly from docs/rules.md Part B.
 *
 * Rules are pure functions: (circuit: CircuitModel) => RuleResult
 *
 * Key domain rules:
 * - Wording for R3: Resistor is "in series with the LED" / "in its path" (never "must come before").
 * - R7 polarity check is reserved for Virtual Builder mode; camera mode does not fail on polarity.
 * - R8 low-confidence check has 'info' status and never turns the overall circuit into warning/fail.
 */

import { DETECTION_CONFIG } from '../config';
import { CircuitModel, RuleResult } from './types';

/**
 * R1: Power source present (Fail severity).
 * At least one battery must be present.
 */
export function checkRuleR1(circuit: CircuitModel): RuleResult {
  const hasBattery = circuit.chain.some((c) => c.type === 'battery');

  if (hasBattery) {
    return {
      id: 'R1',
      status: 'pass',
      title: 'Power source present',
    };
  }

  return {
    id: 'R1',
    status: 'fail',
    title: 'No battery detected.',
    fix: 'The circuit needs a power source. Add a battery.',
  };
}

/**
 * R2: LED present (Warn severity).
 * At least one LED should be present to form a useful load.
 */
export function checkRuleR2(circuit: CircuitModel): RuleResult {
  const hasLed = circuit.chain.some((c) => c.type === 'led');

  if (hasLed) {
    return {
      id: 'R2',
      status: 'pass',
      title: 'LED load present',
    };
  }

  return {
    id: 'R2',
    status: 'warn',
    title: 'No LED found yet.',
    fix: 'Add an LED so there is something to light up.',
  };
}

/**
 * R3: LED has a series resistor (Fail severity).
 * If an LED is present, a resistor must be in series with the LED to limit current.
 * Note: Order does NOT matter electrically. Resistor can be before or after the LED.
 */
export function checkRuleR3(circuit: CircuitModel): RuleResult {
  const hasLed = circuit.chain.some((c) => c.type === 'led');
  if (!hasLed) {
    return {
      id: 'R3',
      status: 'pass',
      title: 'No LED present; resistor check passed',
    };
  }

  const hasResistor = circuit.chain.some((c) => c.type === 'resistor');

  if (hasResistor) {
    return {
      id: 'R3',
      status: 'pass',
      title: 'Resistor in series with LED',
    };
  }

  return {
    id: 'R3',
    status: 'fail',
    title: 'LED has no resistor in its path.',
    fix: 'Add a resistor in series with the LED to limit current.',
  };
}

/**
 * R4: Switch present (Warn severity).
 * A switch allows safely turning the circuit on and off.
 */
export function checkRuleR4(circuit: CircuitModel): RuleResult {
  const hasSwitch = circuit.chain.some((c) => c.type === 'switch');

  if (hasSwitch) {
    return {
      id: 'R4',
      status: 'pass',
      title: 'Control switch present',
    };
  }

  return {
    id: 'R4',
    status: 'warn',
    title: 'No switch to control the circuit.',
    fix: 'Add a switch so you can turn it on and off safely.',
  };
}

/**
 * R5: Loop can close (Warn severity).
 * Both a power source (battery) and at least one load (LED) must be in the chain.
 */
export function checkRuleR5(circuit: CircuitModel): RuleResult {
  const hasBattery = circuit.chain.some((c) => c.type === 'battery');
  const hasLoad = circuit.chain.some((c) => c.type === 'led');

  if (hasBattery && hasLoad) {
    return {
      id: 'R5',
      status: 'pass',
      title: 'Loop can close',
    };
  }

  return {
    id: 'R5',
    status: 'warn',
    title: 'The loop is incomplete.',
    fix: 'Connect the parts in a loop back to the battery.',
  };
}

/**
 * R6: No duplicate LED without resistors (Warn severity).
 * In the MVP series loop, every LED needs its own series resistor or adequate series resistance.
 * Warns if there are multiple LEDs sharing inadequate resistors (leds > resistors when leds > 1).
 */
export function checkRuleR6(circuit: CircuitModel): RuleResult {
  const ledCount = circuit.chain.filter((c) => c.type === 'led').length;
  const resistorCount = circuit.chain.filter((c) => c.type === 'resistor').length;

  if (ledCount <= 1 || resistorCount >= ledCount) {
    return {
      id: 'R6',
      status: 'pass',
      title: 'Valid LED to resistor balance',
    };
  }

  return {
    id: 'R6',
    status: 'warn',
    title: 'More than one LED in the same path.',
    fix: 'Use one resistor per LED, or keep a single LED for now.',
  };
}

/**
 * R7: LED Polarity (Fail severity, Virtual Builder ONLY).
 * In camera mode, orientation/polarity cannot be reliably detected, so camera mode passes.
 * In virtual mode, LED anode must face battery positive. Fails if polarity is reversed.
 */
export function checkRuleR7(circuit: CircuitModel): RuleResult {
  // Only applicable in Virtual Builder mode per docs/rules.md §B2
  if (circuit.mode !== 'virtual') {
    return {
      id: 'R7',
      status: 'pass',
      title: 'Polarity check (Camera mode: orientation approximated)',
    };
  }

  const hasReversedLed = circuit.chain.some(
    (c) => c.type === 'led' && c.polarity === 'reversed'
  );

  if (hasReversedLed) {
    return {
      id: 'R7',
      status: 'fail',
      title: 'LED is reversed.',
      fix: 'Flip the LED so the longer leg faces the positive side.',
    };
  }

  return {
    id: 'R7',
    status: 'pass',
    title: 'LED polarity correct',
  };
}

/**
 * R8: Low-confidence unknown item (Info severity).
 * Warns if any item in the chain has low detection confidence (< LOW_CONFIDENCE_THRESHOLD: 0.60).
 * Status is 'info'; it informs the user without failing or warning the circuit status.
 */
export function checkRuleR8(circuit: CircuitModel): RuleResult {
  const hasLowConfidence = circuit.chain.some(
    (c) => c.confidence < DETECTION_CONFIG.LOW_CONFIDENCE_THRESHOLD
  );

  if (hasLowConfidence) {
    return {
      id: 'R8',
      status: 'info',
      title: 'Not sure about one item.',
      fix: 'Move it closer or improve lighting.',
    };
  }

  return {
    id: 'R8',
    status: 'pass',
    title: 'All components clearly recognized',
  };
}
