import type { APIRoute } from 'astro';
import { renderLlmsTxt } from '../lib/geo';

export const prerender = true;
export const GET: APIRoute = () => new Response(renderLlmsTxt(), {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});
