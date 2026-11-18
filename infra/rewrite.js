// CloudFront Function (viewer request). Terraform fills in ${domain}.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var host = request.headers.host ? request.headers.host.value : '';

  // www.nagels.dev/x → nagels.dev/x
  if (host !== '${domain}') {
    return redirect('https://${domain}' + uri + query(request.querystring));
  }

  // /nl/ → /nl/index.html (the file Next's static export wrote)
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
    return request;
  }

  // /nl → /nl/ (last path segment has no file extension)
  if (uri.lastIndexOf('.') < uri.lastIndexOf('/')) {
    return redirect(uri + '/' + query(request.querystring));
  }

  return request;
}

function redirect(location) {
  return { statusCode: 301, statusDescription: 'Moved Permanently', headers: { location: { value: location } } };
}

function query(qs) {
  var parts = [];
  for (var key in qs) {
    var values = qs[key].multiValue || [qs[key]];
    for (var i = 0; i < values.length; i++) parts.push(key + '=' + values[i].value);
  }
  return parts.length ? '?' + parts.join('&') : '';
}
