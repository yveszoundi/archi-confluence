var drivingviews = {
  "VIEW_TYPES": {
    "VIEW_REF"   : "view-ref",
    "VIEW_GROUP" : "view-group"
  },
  "sections": function (diagramModelGroup_Array_OnSketchDiagram) {
    const _validSectionElements = ['archimate-diagram-model', 'canvas-model', 'sketch-model', 'diagram-model-group']

    function _elementIsConnection(e) {
      return e.type.endsWith("-connection")
    }

    function _newContainer(id, name, type, nativeType, value, level) {
      return {
        id: id, name: name, type: type, nativeType: nativeType, value: value, level: level, children: []
      }
    }

    function _findHeadId(adjacencyListByElementId) {
      if (adjacencyListByElementId.size == 0)
        throw new Error("Empty adjacency list")

      let verticeIds = new Set()
      adjacencyListByElementId.forEach(function (v, k) {
        verticeIds.add(k)
      })

      adjacencyListByElementId.forEach(function (v, k) {
        verticeIds.delete(v)
      })

      if (verticeIds.size == 0)
        throw new Error("Cannot find the head element. Plese verify that each node is connected!")

      if (verticeIds.size != 1)
        throw new Error("Multiple head elements found!", JSON.stringify(verticeIds, null, 2))

      const [firstVertice] = verticeIds

      return firstVertice
    }    

    function _walkItem(adjacencyListByElementId, item) {
      let currentAdjacencyListByElementId = new Map()
      let elementById = new Map()

      $(item.value).children().each(function(e) {
        if (!_elementIsConnection(e)) {
          if (!_validSectionElements.includes(e.type)) {
            let message = "Found invalid element type: '" + e.type + "' in section: " + _elementName(e)
            message = message + "Valid elements are:" + JSON.stringify(validSectionElements)
            throw new Error(message)
          }

          elementById.set(e.id, e)
        }          
      })

      let tail

      elementById.forEach(function(element, elementId) {
        if (adjacencyListByElementId.has(elementId)) {
          currentAdjacencyListByElementId.set(elementId, adjacencyListByElementId.get(elementId))
        } else {
          if (!tail) {
            tail = element
          } else {
            let message = "Duplicate tails founds."
            let tailName = _elementName(tail)
            let elementName = _elementName(element)
            message = message + " It looks like element (id='" + tail.id + "', name='" + tailName + "')"
            message = message + " and element(id='" + elementId + "', name='" + elementName + "')"
            message = message + " are both pointing to nothing!"
            message = message + " Please note that you can only connect elements at the same level,"
            message = message + " i.e. not nested elements with top-level containers, etc."

            throw new Error(message)
          }
        }
      })

      let result = []

      if (elementById.size != 0) {
        if (!tail)
          throw new Error("Could not find the last page/section element, please check your diagram.")

        let currentId = tail.id

        if (elementById.size > 1)
          currentId = _findHeadId(currentAdjacencyListByElementId)

        while (currentId) {
          let element = elementById.get(currentId)
          let type = (_isArchimateDiagram(element.type)) ? "view-ref" : "view-group"
          let elementName = _elementName(element)
          let itemContainer = _newContainer(currentId, elementName, type, element.type,  element, (item.level + 1))

          if (type != 'view-ref')
            _walkItem(adjacencyListByElementId, itemContainer)
          
          item.children.push(itemContainer)
          result.push(item)
          currentId = currentAdjacencyListByElementId.get(currentId)
        }
      }

      return item
    }

    function _elementName(element) {
      if (element.labelValue && element.labelValue.trim().length != 0)
        return element.labelValue

      return element.name
    }

    function _buildAdjacencyListByElementId(root) {
      let adjacencyListByElementId = new Map()

      $(root).find().filter(_elementIsConnection).each(function(e) {
        let sourceId = e.source.id
        let targetId = e.target.id

        if (adjacencyListByElementId.has(sourceId))
          throw new Error("Duplicate connection detected for element:" +  e.source)

        adjacencyListByElementId.set(sourceId, targetId)
      })

      return adjacencyListByElementId
    }

    function _isArchimateDiagram(elementType) {
      if (elementType == 'archimate-diagram-model')
        return true

      if (elementType == 'sketch-model')
        return true

      if (elementType == 'canvas-model')
        return true

      return false
    }

    function _removeValuePropertyFromResult(result) {
      delete result.value

      for (let element of result.children) {
        _removeValuePropertyFromResult(element)
      }
    }

    function _validateInput(input) {
      if (!Array.isArray(input))
        throw new Error("Please provide an array of diagram-model-group elements ('Group' elements on a sketch view)")

      for (let inputElement of input) {
        if (!inputElement.type || !inputElement.view)
          throw new Error("No type or view found for element:" + inputElement + ". Is it a valid Archi object?")

        if (inputElement.view.type != 'sketch-model')
          throw new Error("Please select provide a set of 'diagram-model-group' elements on a sketch diagram. Only sketch diagrams are supported for now!")

        if (inputElement.type != 'diagram-model-group')
          throw new Error("Unexpected element type:'", inputElement.type + "'. Only elements of type 'diagram-model-group' are supported.")
      }
    }

    _validateInput(diagramModelGroup_Array_OnSketchDiagram)

    let result= []

    if (diagramModelGroup_Array_OnSketchDiagram.length == 0)
      return result

    let currentView = diagramModelGroup_Array_OnSketchDiagram[0].view
    let adjacencyListByElementId = _buildAdjacencyListByElementId(currentView)
    let pages = diagramModelGroup_Array_OnSketchDiagram

    for (let page of pages) {
      let pageName = _elementName(page)
      let pageWithSections = _walkItem(adjacencyListByElementId, _newContainer(page.id, pageName, "page", page.type, page, 0))
      _removeValuePropertyFromResult(pageWithSections)
      result.push(pageWithSections)
    }

    return result
  }
}


