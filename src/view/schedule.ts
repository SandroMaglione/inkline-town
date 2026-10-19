/** The view's schedule, run once a frame after the simulation's steps and before the renderer's. */
import { Game } from "../game/schema.ts"
import { ShowFeedback } from "./feedback.ts"
import { Project } from "./project.ts"

export const project = Game.Schedule(ShowFeedback, Project)
