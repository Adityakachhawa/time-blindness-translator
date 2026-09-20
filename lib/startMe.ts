/**
 * Deterministic generator for the Start Me experiment.
 * Takes a user's task and returns an extremely small, concrete first step.
 */
export function generateTinyStep(task: string): string {
  const t = task.toLowerCase();
  
  if (t.includes('clean') || t.includes('tidy') || t.includes('room') || t.includes('organize')) {
    return 'Pick up 5 things from the floor.';
  }
  
  if (t.includes('email') || t.includes('write') || t.includes('essay') || t.includes('report') || t.includes('reply')) {
    return 'Open a blank draft and write one sentence.';
  }
  
  if (t.includes('dish') || t.includes('kitchen') || t.includes('cook')) {
    return 'Wash one dish.';
  }
  
  if (t.includes('workout') || t.includes('exercise') || t.includes('gym') || t.includes('run')) {
    return 'Put on your workout shoes.';
  }
  
  if (t.includes('laundry') || t.includes('clothes') || t.includes('wash') || t.includes('fold')) {
    return 'Put one item of clothing into the basket.';
  }
  
  if (t.includes('study') || t.includes('read') || t.includes('homework') || t.includes('book')) {
    return 'Open the book or document to the correct page.';
  }

  // Fallback
  return 'Gather what you need and put it in front of you.';
}
