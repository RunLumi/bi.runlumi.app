/** Reusable relational authority check. These identifiers are server-owned SQL,
 * never a browser/model query. Source approval is rechecked on retained artifacts.
 */
export const invalidPublicationSources = `SELECT i.tenant_id,i.publication_id FROM commerce_publication_inputs i
 JOIN commerce_normalizations n ON n.tenant_id=i.tenant_id AND n.id=i.normalization_id
 JOIN commerce_receipts r ON r.tenant_id=n.tenant_id AND r.id=n.receipt_id
 JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
 WHERE c.state!='active' OR c.revision!=r.connection_revision OR r.state='REVOKED'`;
