/** Reusable relational authority check. These identifiers are server-owned SQL,
 * never a browser/model query. Source approval is rechecked on retained artifacts.
 */
export const invalidPublicationSources = `SELECT i.publication_id FROM commerce_publication_inputs i
 JOIN commerce_normalizations n ON n.id=i.normalization_id
 JOIN commerce_receipts r ON r.id=n.receipt_id
 JOIN commerce_connections c ON c.id=r.connection_id
 WHERE c.state!='active' OR c.revision!=r.connection_revision OR r.state='REVOKED'`;
