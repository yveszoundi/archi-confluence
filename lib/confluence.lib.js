let HttpURLConnection= Java.type("java.net.HttpURLConnection")
let BufferedReader= Java.type("java.io.BufferedReader")
let InputStreamReader = Java.type("java.io.InputStreamReader")
let DataOutputStream= Java.type("java.io.DataOutputStream")
let URL = Java.type("java.net.URL")
let Base64 = Java.type("java.util.Base64")
let JString = Java.type("java.lang.String")

var confluence = {
  "_readResponseToString": function(streamData) {
    let reader
    let result = ""

    try {
      reader = new BufferedReader(new InputStreamReader(streamData))
      let line

      while ( (line = reader.readLine()) != null) {
        result += line
      }
    } finally {
      if (reader)
        reader.close()
    }

    return result
  },
  "imageDataBytesFromBase64": function(base64Image) {
    return Base64.getDecoder().decode(base64Image)
  },
  "_encodedCredentials": function(userCredentials) {
    let creds = new JString(userCredentials).getBytes()
    
    return new JString(Base64.getEncoder().encode(creds))
  },
  "_statusCodeIsSucess": function(statusCode) {
    return (statusCode >= 200 && statusCode <= 300)
  },
  "attachImage": function(confluenceSettings, pageId, imageName, imageBytes) {
    let connectionAddress = new URL(confluenceSettings.baseUrl + "/rest/api/content/" + pageId + "/child/attachment")
    let httpConnection = connectionAddress.openConnection()
    let basicAuth = "Basic " + this._encodedCredentials(confluenceSettings.username + ":" + confluenceSettings.apiToken)
    let boundary = "*****"
    let crlf = "\r\n"
    let twoHypens = "--"

    httpConnection.setRequestProperty("Authorization", basicAuth)
    httpConnection.setRequestProperty("X-Atlassian-Token", "nocheck")
    httpConnection.setUseCaches(false)
    httpConnection.setDoInput(true)
    httpConnection.setDoOutput(true)
    httpConnection.setRequestMethod("PUT")
    httpConnection.setRequestProperty("Connection", "Keep-Alive")
    httpConnection.setRequestProperty("file", imageName)
    httpConnection.setRequestProperty("Cache-Control", "no-cache")
    httpConnection.setRequestProperty("Content-Type-Control", "multipart/form-data;boundary=" + boundary)

    httpConnection.connect()

    let request = new DataOutputStream(httpConnection.getOutputStream())

    request.writeBytes(twoHypens + boundary + crlf)
    request.writeBytes("Content-Disposition: form-data; name=\"file\";" + "filename=\"" + imageName + "\"" + crlf)
    request.writeBytes("Content-Type: image/png" + crlf)
    request.writeBytes("Content-Transfer-Encoding: binary" + crlf)
    request.writeBytes(crlf)

    // write image
    request.write(Java.to(imageBytes, "byte[]"))

    // end content wrapper
    request.writeBytes(crlf)
    request.writeBytes(twoHypens + boundary + twoHypens + crlf)

    // flush
    request.flush()
    request.close()

    let statusCode = httpConnection.getResponseCode()

    if (!this._statusCodeIsSucess(statusCode)) {
      throw new Error(this._readResponseToString(httpConnection.getErrorStream()))
    }

    console.log(this._readResponseToString(httpConnection.getInputStream()))
  },
  "updateConfluencePageContents": function(confluenceSettings, pageId, pageTitle, pageVersion, pageContents) {
    let connectionAddress = new URL(confluenceSettings.baseUrl + "/rest/api/content/" + pageId)
    let httpConnection = connectionAddress.openConnection()
    let basicAuth = "Basic " + this._encodedCredentials(confluenceSettings.username + ":" + confluenceSettings.apiToken)

    httpConnection.setRequestProperty("Authorization", basicAuth)
    httpConnection.setRequestProperty("X-Atlassian-Token", "nocheck")
    httpConnection.setUseCaches(false)
    httpConnection.setDoInput(true)
    httpConnection.setDoOutput(true)
    httpConnection.setRequestMethod("PUT")
    httpConnection.setRequestProperty("Connection", "Keep-Alive")
    httpConnection.setRequestProperty("Cache-Control", "no-cache")
    httpConnection.setRequestProperty("Content-Type", "application/json")
    httpConnection.setRequestProperty("Accept", "application/json")

    httpConnection.connect()

    let request = new DataOutputStream(httpConnection.getOutputStream())
    let requestData = {
      "id"   : pageId,
      "type" : "page",
      "space": {
        "key": confluenceSettings.spaceKey
      },
      "title": pageTitle,
      "version": {
        "number": pageVersion
      },
      "body": {
        "storage": {
          "value": pageContents,
          "representation": "storage"
        }
      }
    }

    // write image
    request.writeBytes(JSON.stringify(requestData))

    // flush output
    request.flush()
    request.close()

    let statusCode = httpConnection.getResponseCode()

    if (!this._statusCodeIsSucess(statusCode))
      throw new Error(this._readResponseToString(httpConnection.getErrorStream()))

    console.log(this._readResponseToString(httpConnection.getInputStream()))
  },
  "confluencePageInformation": function (confluenceSettings, pageTitle) {
    let urlString = (confluenceSettings.baseUrl + "/rest/api/content?title=" + encodeURIComponent(pageTitle) + "&spaceKey=" + confluenceSettings.spaceKey + "&expand=version")
    let connectionAddress = new URL(urlString)
    let httpConnection= connectionAddress.openConnection()
    let basicAuth = "Basic " + this._encodedCredentials(confluenceSettings.username + ":" + confluenceSettings.apiToken)

    httpConnection.setRequestProperty("Authorization", basicAuth)
    httpConnection.setRequestMethod("GET")
    httpConnection.connect()

    let statusCode = httpConnection.getResponseCode()

    if (!this._statusCodeIsSucess(statusCode))
      throw new Error(this._readResponseToString(httpConnection.getErrorStream()))

    let httpResponse = this._readResponseToString(httpConnection.getInputStream())
    let jsonResponse = JSON.parse(httpResponse)

    if (jsonResponse["results"].length == 0)
      throw new Error("Cannot find page in space '", confluenceSettings.spaceKey, "' with title:'", pageTitle, "'.")
    
    let pageId = jsonResponse["results"][0]["id"]
    let versionNum = jsonResponse["results"][0]["version"]["number"]
    let pageVersion = parseInt(versionNum)

    return { "pageId": pageId, "pageVersion": pageVersion }
  }
}
