// Fills the local development database with a few exercises and workouts.
// Run with `npm run db:seed`. Never meant for production.

const SAMPLE_WORKOUTS: {
  daysAgo: number;
  notes?: string;
  exercises: Record<string, [reps: number, weightKg: number | null][]>;
}[] = [
  {
    daysAgo: 7,
    exercises: {
      Squat: [
        [5, 80],
        [5, 80],
        [5, 80],
      ],
      "Bench Press": [
        [8, 60],
        [8, 60],
        [7, 60],
      ],
      "Pull-up": [
        [8, null],
        [6, null],
      ],
    },
  },
  {
    daysAgo: 4,
    notes: "Short session",
    exercises: {
      Deadlift: [
        [5, 100],
        [5, 100],
      ],
      "Overhead Press": [
        [8, 37.5],
        [8, 37.5],
        [6, 37.5],
      ],
    },
  },
  {
    daysAgo: 2,
    exercises: {
      Squat: [
        [5, 82.5],
        [5, 82.5],
        [4, 82.5],
      ],
      "Bench Press": [
        [8, 60],
        [8, 60],
        [8, 60],
      ],
      "Pull-up": [
        [9, null],
        [7, null],
      ],
    },
  },
];

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  if (!["localhost", "127.0.0.1"].includes(host)) {
    throw new Error(`The seed only runs against a local database, not "${host}".`);
  }

  // Imported here so the check above runs before any connection is set up.
  const { db } = await import("@/lib/db/client");
  const { createExercise } = await import("@/lib/db/queries/exercises");
  const { addSet } = await import("@/lib/db/queries/sets");
  const { addExerciseToWorkout } = await import(
    "@/lib/db/queries/workout-exercises"
  );
  const { getOrCreateWorkout, listWorkoutSummaries, updateWorkoutNotes } =
    await import("@/lib/db/queries/workouts");

  try {
    const existing = await listWorkoutSummaries({ limit: 1 });
    if (existing.length > 0) {
      console.log("The database already has workouts; nothing was seeded.");
      return;
    }

    for (const sample of SAMPLE_WORKOUTS) {
      const workout = await getOrCreateWorkout(dateDaysAgo(sample.daysAgo));
      if (sample.notes) await updateWorkoutNotes(workout.id, sample.notes);
      for (const [name, sets] of Object.entries(sample.exercises)) {
        const exercise = await createExercise(name);
        const entry = await addExerciseToWorkout(workout.id, exercise.id);
        for (const [reps, weightKg] of sets) {
          await addSet(entry.id, { reps, weightKg });
        }
      }
    }
    console.log(`Seeded ${SAMPLE_WORKOUTS.length} workouts.`);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
