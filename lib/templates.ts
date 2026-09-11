export interface TinyTemplate {
  min5: string;
  min15: string;
}

const TEMPLATE_DICTIONARY: Record<string, TinyTemplate> = {
  clean: {
    min5: "Put obvious trash away, clear one single surface.",
    min15: "Gather trash, put away clothes, clear desk, sweep floor.",
  },
  study: {
    min5: "Open textbook, gather notes, read the very first paragraph.",
    min15: "Review notes, read one small section, write down 3 key points.",
  },
  email: {
    min5: "Open inbox, delete junk, reply to exactly one easy email.",
    min15: "Reply to 3 quick emails, draft one important email, close tab.",
  },
  admin: {
    min5: "Locate the necessary documents, log into the required portal.",
    min15: "Fill out the first page of the form, verify details, hit save.",
  },
  work: {
    min5: "Open the project, read the last thing you did, plan the next step.",
    min15: "Complete the smallest logical chunk of work, document progress.",
  },
  organize: {
    min5: "Group similar items together in one small area.",
    min15: "Sort one drawer or corner, throw away obvious clutter.",
  },
  cook: {
    min5: "Get out all ingredients and place them on the counter.",
    min15: "Chop vegetables, prep ingredients, preheat the oven/pan.",
  },
  wash: {
    min5: "Gather all laundry/dishes and put them in one central pile.",
    min15: "Load the machine, add soap, and start the cycle.",
  },
  read: {
    min5: "Open the book, read the first page or paragraph.",
    min15: "Read one full chapter or section without stopping.",
  },
  write: {
    min5: "Open a blank document and write one single sentence.",
    min15: "Brainstorm a rough outline, write the first paragraph.",
  },
  exercise: {
    min5: "Put on workout clothes and do some light stretching.",
    min15: "Do a quick warm-up and one set of your core routine.",
  },
};

const DEFAULT_TEMPLATE: TinyTemplate = {
  min5: "Gather your materials, do the very first step for 3 minutes, then stop.",
  min15: "Work on the smallest possible chunk without worrying about the big picture.",
};

export function getTinyTemplates(taskName: string): TinyTemplate {
  if (!taskName) return DEFAULT_TEMPLATE;
  
  const normalized = taskName.toLowerCase().trim();
  
  // Search for keyword matches in the task name
  for (const [keyword, template] of Object.entries(TEMPLATE_DICTIONARY)) {
    if (normalized.includes(keyword)) {
      return template;
    }
  }
  
  return DEFAULT_TEMPLATE;
}
