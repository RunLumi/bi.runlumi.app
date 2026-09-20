import { site, faqs } from '../data/site.ts';
import { publicContactEmail } from '../data/contact.ts';

interface PageMetadata {
  canonical: string;
  title: string;
  description: string;
  includeFaq?: boolean;
  email?: string;
}

// Data only. This module runs at build time; it never fetches or executes content.
export function createStructuredData({ canonical, title, description, includeFaq = false, email = site.email }: PageMetadata) {
  const url = new URL(canonical);
  if (url.origin !== site.origin || url.search || url.hash) {
    throw new Error('Structured data must use a clean public-site canonical URL');
  }
  if (includeFaq && url.pathname !== '/') {
    throw new Error('The shared FAQ is rendered only on the homepage');
  }
  const home = `${site.origin}/`;
  const organization = { '@id': `${home}#organization` };
  const website = { '@id': `${home}#website` };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        ...organization,
        name: site.name,
        url: home,
        logo: `${site.origin}/brand/lumi.svg`,
        email: publicContactEmail(email),
      },
      {
        '@type': 'WebSite',
        ...website,
        name: site.name,
        url: home,
        description: site.description,
        inLanguage: 'vi-VN',
        publisher: organization,
      },
      {
        '@type': includeFaq ? ['WebPage', 'FAQPage'] : 'WebPage',
        '@id': `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        inLanguage: 'vi-VN',
        isPartOf: website,
        author: organization,
        publisher: organization,
        // An editorial review date, never a fabricated build-time freshness signal.
        dateModified: site.reviewedAtISO,
        ...(includeFaq ? {
          mainEntity: faqs.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        } : {}),
      },
    ],
  };
}

// JSON.stringify alone does not stop </script> from terminating an HTML data block.
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError('JSON-LD must be JSON-serializable');
  return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export function renderLlmsTxt(email = site.email): string {
  // Share the actual public answers, including limitations; no second marketing truth.
  const answers = faqs.map(({ question, answer }) => `**${question}**\n\n${answer}`).join('\n\n');
  return `# ${site.name}

> ${site.description}

Trang giới thiệu: ${site.origin}/
Nền tảng BI (bề mặt riêng, không thuộc trang giới thiệu): ${site.appOrigin}/
Nội dung: ${site.name}. Rà soát: ${site.reviewedAtISO}.
Liên hệ: ${publicContactEmail(email)}.

${answers}

## Nội dung công khai

- [Giới thiệu Lumi BI](${site.origin}/): Định hướng sản phẩm và bản minh họa.
- [Giá trị](${site.origin}/#gia-tri): Tiền, tồn kho và ngoại lệ vận hành.
- [Kết nối](${site.origin}/#ket-noi): Tích hợp dự kiến, chưa phải quan hệ đối tác hay kết nối đã phát hành.
- [Câu hỏi thường gặp](${site.origin}/#cau-hoi): Nguồn của các câu trả lời ở trên.
- [Trao đổi pilot](${site.origin}/#bat-dau): Xác nhận phạm vi trước khi bắt đầu; không tự động gửi email.

## Optional

- [Quyền riêng tư](${site.origin}/quyen-rieng-tu/): Phạm vi xử lý thông tin của trang giới thiệu.
`;
}
