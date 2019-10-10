import encodeHTML from 'escape-html';

interface Inputs {
  http_status_code: number;
  http_status_description: string;
  error_code?: string;
  now_id: string;
}

export default function error(it: Inputs): string {
  let out =
    '<main> <p class="devinfo-container"> <span class="error-code"><strong>' +
    it.http_status_code +
    '</strong>: ' +
    encodeHTML(it.http_status_description) +
    '</span> ';
  if (it.error_code) {
    out +=
      ' <span class="devinfo-line">Code: <code>' +
      encodeHTML(it.error_code) +
      '</code></span> ';
  }
  out +=
    ' <span class="devinfo-line">ID: <code>' +
    encodeHTML(it.now_id) +
    '</code> </p></main>';
  return out;
}
