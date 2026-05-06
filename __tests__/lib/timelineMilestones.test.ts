import { timelineMilestones } from '@/lib/timelineMilestones';

describe('timelineMilestones', () => {
  it('keeps timeline content in a reusable configuration module', () => {
    expect(timelineMilestones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'MusesSystem 0.02',
          modelGroups: expect.arrayContaining([
            expect.objectContaining({
              label: '文本',
              models: expect.arrayContaining(['GPT-5 Mini']),
            }),
          ]),
        }),
      ])
    );
  });
});
