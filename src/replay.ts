import {
  formatReplayReport,
  runAssessmentScenario,
} from "./scenario.js";

const report = runAssessmentScenario();
process.stdout.write(`${formatReplayReport(report)}\n`);
