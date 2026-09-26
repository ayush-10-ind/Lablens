/**
 * Static educational content for the prebuilt LED circuit guide.
 * Strictly non-generative content definition (docs/architecture.md §5.0, §6.0 and docs/rules.md §B3).
 */

import { GuideCircuitContent } from './types';

export const LED_CIRCUIT_GUIDE_CONTENT: GuideCircuitContent = {
  id: 'led-circuit',
  title: 'LED Circuit Guide',
  steps: [
    {
      stepNumber: 1,
      componentId: 'battery',
      label: 'Battery',
      caption: 'The battery supplies electrical potential across the circuit.',
    },
    {
      stepNumber: 2,
      componentId: 'switch',
      label: 'Switch',
      caption: 'The switch opens or closes the conductive path.',
    },
    {
      stepNumber: 3,
      componentId: 'resistor',
      label: 'Resistor',
      caption: 'The resistor limits current in series with the LED to prevent burnout.',
    },
    {
      stepNumber: 4,
      componentId: 'led',
      label: 'LED',
      caption: 'The LED converts electrical energy into light when forward-biased.',
    },
  ],
  contextGuidance: {
    r3Fail: "Place a resistor in series with the LED so it isn't overloaded.",
    r5Warn: 'Connect the parts in a continuous loop back to the battery.',
    circuitOk: 'Circuit complete: current flows through the series path and illuminates the LED.',
  },
};
