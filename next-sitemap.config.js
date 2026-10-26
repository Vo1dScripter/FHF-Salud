/**
 * @type {import('next-sitemap').IConfig}
 * @see https://github.com/iamvishnusankar/next-sitemap#readme
 */
module.exports = {
  // !STARTERCONF Change the siteUrl
  /** Without additional '/' on the end, e.g. https://theodorusclarence.com */
  siteUrl: 'https://fhf-salud.vercel.app',
  generateRobotsTxt: true,
  // La herramienta opt-in de QA no forma parte de las rutas públicas.
  exclude: ['/citas/vista-previa'],
  robotsTxtOptions: {
    policies: [{ userAgent: '*', allow: '/' }],
  },
};
