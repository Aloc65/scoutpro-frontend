import { Platform } from 'react-native';
import { api, getToken } from '../api/client';
import { showAlert } from './alert';

/**
 * Download a single player report as a branded PDF.
 *
 * On web it fetches the PDF as a blob (with the JWT auth header) and triggers a
 * browser download. On native it shows a hint to use the web version (matching
 * the existing weekly-report download behaviour).
 *
 * Returns true if the download was triggered successfully.
 */
export async function downloadReportPdf(reportId: string): Promise<boolean> {
  try {
    if (Platform.OS !== 'web') {
      showAlert(
        'Download',
        'PDF download is available on the web version. Open ScoutPro in your browser to download this report.',
      );
      return false;
    }

    const token = await getToken();
    const baseUrl = api.baseUrl;
    const response = await fetch(`${baseUrl}/api/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'Download failed' }));
      throw new Error(err.message || `Download failed: ${response.status}`);
    }

    const blob = await response.blob();
    const filename =
      response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ||
      'FFS_Report.pdf';

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return true;
  } catch (e: any) {
    showAlert('Download Failed', e.message || 'Failed to generate the report PDF.');
    return false;
  }
}
