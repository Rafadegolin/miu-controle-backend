/**
 * Extrai informações do dispositivo a partir do User-Agent
 */
export function parseDeviceInfo(userAgent: string): string {
  if (!userAgent) return 'Dispositivo Desconhecido';

  // Detectar SO
  let os = 'Desconhecido';
  if (userAgent.includes('Windows NT 10.0')) os = 'Windows 10';
  else if (userAgent.includes('Windows NT 11.0')) os = 'Windows 11';
  else if (userAgent.includes('Mac OS X')) os = 'macOS';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad'))
    os = 'iOS';
  else if (userAgent.includes('Linux')) os = 'Linux';

  // Detectar navegador
  let browser = 'Desconhecido';
  if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/'))
    browser = 'Chrome';
  else if (userAgent.includes('Firefox/')) browser = 'Firefox';
  else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/'))
    browser = 'Safari';
  else if (userAgent.includes('Opera/') || userAgent.includes('OPR/'))
    browser = 'Opera';

  // Extrair versão do navegador
  let version = '';
  const patterns = {
    Chrome: /Chrome\/(\d+)/,
    Firefox: /Firefox\/(\d+)/,
    Safari: /Version\/(\d+)/,
    Edge: /Edg\/(\d+)/,
    Opera: /OPR\/(\d+)/,
  };

  const pattern = patterns[browser];
  if (pattern) {
    const match = userAgent.match(pattern);
    if (match) version = match[1];
  }

  return `${browser}${version ? ' ' + version : ''} - ${os}`;
}
