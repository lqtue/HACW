// Visitor-facing destination list: everything in destinations.json minus sites the
// organiser flagged `closed` for the festival. Editors, the API and /organizer keep
// importing the raw JSON so a closed site is still editable and its counts still show.
import all from './destinations.json';
export default all.filter((d) => !d.closed);
