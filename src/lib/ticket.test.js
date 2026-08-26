import assert from 'node:assert';
import { isValidSet, TICKETS, isTicketQr, parseTicket, ticketSize } from './ticket.js';
import { codeFromTicket } from './backup.js';

const dests = [
  { id: 'm1', ticketClass: 'monument' },
  { id: 'm2', ticketClass: 'monument' },
  { id: 'mu1', ticketClass: 'museum' },
  { id: 'mu2', ticketClass: 'museum' },
  { id: 'o1', ticketClass: 'other' },
  { id: 'o2', ticketClass: 'other' },
  { id: 'o3', ticketClass: 'other' },
  { id: 'o4', ticketClass: 'other' }
];

// valid 5-set: 1 monument + 1 museum + 3 other
assert.ok(isValidSet(['m1', 'mu1', 'o1', 'o2', 'o3'], dests, 5));
// free slots may be a second monument/museum — recipe is minimums
assert.ok(isValidSet(['m1', 'mu1', 'm2', 'mu2', 'o1'], dests, 5));
// missing a museum -> invalid
assert.ok(!isValidSet(['m1', 'o1', 'o2', 'o3', 'o4'], dests, 5));
// missing a monument -> invalid
assert.ok(!isValidSet(['mu1', 'mu2', 'o1', 'o2', 'o3'], dests, 5));
// wrong length
assert.ok(!isValidSet(['m1', 'mu1', 'o1', 'o2'], dests, 5));
// duplicate stop
assert.ok(!isValidSet(['m1', 'mu1', 'o1', 'o1', 'o2'], dests, 5));
// unknown id
assert.ok(!isValidSet(['m1', 'mu1', 'o1', 'o2', 'zzz'], dests, 5));

// the 3-site ticket takes any three; an unwired size is still rejected
assert.ok(isValidSet(['m1', 'o1', 'o2'], dests, 3));
assert.ok(!isValidSet(['m1', 'o1', 'o2', 'o3'], dests, 4));

// accepts an id->dest map too
const byId = Object.fromEntries(dests.map((d) => [d.id, d]));
assert.ok(isValidSet(['m1', 'mu1', 'o1', 'o2', 'o3'], byId, 5));

// unknown size
assert.ok(!isValidSet(['m1', 'mu1', 'o1', 'o2', 'o3'], dests, 4));
assert.equal(TICKETS[5].size, 5);

// --- isTicketQr: reject non-ticket QRs before deriving a recovery code ---
// real 2026 Hội An ticket: printed code + tracuuhddt7…com.vn lookup portal
assert.ok(isTicketQr('EBL0226T1490955889'), 'the real bare lookup code is a ticket');
assert.ok(isTicketQr('https://tracuuhddt79.example.com.vn/tra-cuu?ma=EBL0226T1490955889'), 'the real tracuuhddt lookup URL');
assert.ok(isTicketQr('https://tracuuhddt.gdt.gov.vn/?code=EBL0226T1490955889'), 'invoice-lookup URL');
assert.ok(!isTicketQr('https://example.com/promo'), 'a link to some other site is not a ticket');
assert.ok(!isTicketQr('WIFI:S:CafeHoiAn;T:WPA;P:secret;;'), 'a wifi QR is not a ticket');
assert.ok(!isTicketQr('BEGIN:VCARD\nFN:X\nEND:VCARD'), 'a vCard is not a ticket');
assert.ok(!isTicketQr('tel:+84905123456'), 'a tel: QR is not a ticket');
assert.ok(!isTicketQr('hi'), 'too short');
assert.ok(!isTicketQr('two words here'), 'free text with spaces is not a code');
assert.ok(!isTicketQr(null) && !isTicketQr(123), 'non-strings are rejected');

console.log('ticket.test.js ok');

// --- parseTicket(): the printed lookup code carries the ticket type ---
{
  const five = parseTicket('EBL0226T1490955889');
  assert.deepStrictEqual(five, { code: 'T1490955889', size: 5, serial: '90955889' });
  const three = parseTicket('EBL0226T1590955889');
  assert.strictEqual(three.size, 3, '15 = 3-site ticket');
  // the QR is the invoice-portal URL with the same code inside
  assert.strictEqual(
    parseTicket('https://tracuuhddt7.example.com.vn/?code=EBL0226T1490955889').code,
    'T1490955889',
    'same code from the QR URL as from the printed text'
  );
  // a scan and a typed code must derive the SAME recovery code
  assert.strictEqual(
    codeFromTicket('https://tracuuhddt7.example.com.vn/?code=EBL0226T1490955889'),
    codeFromTicket('EBL0226T1490955889')
  );
  // different serial -> different passport
  assert.notStrictEqual(codeFromTicket('EBL0226T1490955889'), codeFromTicket('EBL0226T1490955890'));
  // unreadable / not a ticket
  assert.strictEqual(parseTicket('WIFI:S:cafe;'), null);
  assert.strictEqual(parseTicket('EBL0226T1390955889'), null, 'unknown type digits');
  assert.strictEqual(ticketSize('nonsense'), 5, 'falls back to the 5-site recipe');
  assert.strictEqual(ticketSize('EBL0226T1590955889'), 3);
}

// a 3-site ticket still needs exactly three
assert.ok(!isValidSet(['m1', 'o1'], dests, 3), '3-site needs three');
