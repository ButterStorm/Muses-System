import { Template } from 'e2b';

export const template = Template()
  .fromNodeImage('22')
  .runCmd('node -v && npm -v');
