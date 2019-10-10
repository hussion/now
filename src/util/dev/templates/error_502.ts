import encodeHTML from 'escape-html';

interface Inputs {
  app_error: boolean;
  title: string;
  subtitle?: string;
  http_status_code: number;
  http_status_description: string;
  error_code?: string;
  now_id: string;
}

export default function error_502(it: Inputs): string {
  let out = '<header> <div class="header-item first';
  if (it.app_error) {
    out += ' active';
  }
  out +=
    '"> <svg class="header-item-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"> ';
  if (it.app_error) {
    out += ' <circle cx="8" cy="8" r="8" fill="#FF0080" /> ';
  } else {
    out += ' <circle cx="8" cy="8" r="7.5" stroke="#CCCCCC" /> ';
  }
  out +=
    ' </svg> <div class="header-item-content"> <h1>Application Error</h1> <p>The error occurred in the hosted application</p> </div> </div> <div class="header-item';
  if (!it.app_error) {
    out += ' active';
  }
  out +=
    '"> <svg class="header-item-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"> ';
  if (!it.app_error) {
    out += ' <circle cx="8" cy="8" r="8" fill="#FF0080" /> ';
  } else {
    out += ' <circle cx="8" cy="8" r="7.5" stroke="#CCCCCC" /> ';
  }
  out +=
    ' </svg> <div class="header-item-content"> <h1>Platform Error</h1> <p>The error occurred in the infrastructure layer</p> </div> </div></header><main> <p> <h1 class="error-title">' +
    encodeHTML(it.title) +
    '</h1> ';
  if (it.subtitle) {
    out += ' <p>' + encodeHTML(it.subtitle) + '</p> ';
  }
  out +=
    ' </p> <p class="devinfo-container"> <span class="error-code"><strong>' +
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
    '</code> </p> ';
  if (it.app_error) {
    out +=
      ' <p> <ul> <li> If you are a visitor; contact the website owner or try again later. </li> <li> If you are the owner; <a href="/_logs" target="_blank">check the logs</a> for the application error. </li> </ul> <a target="_blank" href="https://zeit.co/docs/router-status/' +
      it.http_status_code +
      '" class="docs-link" rel="noopener noreferrer">Developer Documentation →</a> </p> ';
  } else {
    out +=
      ' <p> <ul> <li> If you are a visitor, please try again later. </li> <li> If you are the owner, no action is needed. Our engineers have been notified. </li> </ul> </p> ';
  }
  out += '</main>';
  return out;
}
