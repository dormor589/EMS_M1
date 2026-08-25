/**
 * models/index.js — barrel export for the five domain entities.
 *
 * These mirror the client's models one-for-one, and map 1:1 onto the five
 * database tables, so the ERD, the UML class diagram and the API payloads all
 * describe the same model.
 */
export { default as User }       from './User.js';
export { default as Exam }       from './Exam.js';
export { default as Question }   from './Question.js';
export { default as Submission } from './Submission.js';
export { default as Answer }     from './Answer.js';
