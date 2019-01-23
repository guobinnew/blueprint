import konva from 'konva'
import uniqid from 'uniqid'
var  _  = require('lodash')

/**
 * 编辑面板
 */
class Stage {
  constructor(options) {
    this.options = {
      draggable: false,
      canZoom: true,
      model: {
        portName: 'name',
        showDataType: true
      }
    }
    _.merge(this.options, options)

    this.stage = new konva.Stage(this.options)

    this.layers = {}
    // 创建图层
    this.modelIndex = {}
    this.layers.model = new konva.Layer()
    this.stage.add(this.layers.model)

    // 连线层
    this.linkIndex = {}
    this.layers.link = new konva.Layer()
    this.stage.add(this.layers.link)

    // 是否被修改
    this.modified = false

    // 当前选中连线
    this.selectedLine = null

    // 临时连线
    this.tempLine = this.createTempLine()
    this.layers.link.add(this.tempLine)
    // 新连线端口
    this.linePorts = []

    // 当前鼠标位置
    this.mousePos = {
      x: 0,
      y: 0
    }

    // 是否处于连线状态
    this.isLinking = false
    // 连线锚点（用于编辑连线）
    this.anchors = []

    // 是否允许缩放
    this.zoom = 1.0
    this.minZoom = 0.1
    this.maxZoom = 10
    this.zoomFactor = 1.25

    // 操作列表（用于Undo， Redo）
    this.maxAction = 50
    this.actions = []
    // 当前操作列表游标索引
    this.actionIndex = -1

    // 鼠标事件
    this.stage.on('mousedown', (evt) => {
      let shape = evt.target
      // 如果点击编辑器空白区，则取消选中状态
      if (shape instanceof konva.Stage) {
        if (this.selectedLine) {
          let mod = this.selectedLine.getAttr('linkmod')
          if (mod) {
            this.snapshot()
            this.selectedLine.setAttr('linkmod', false)
          }
          this.hideAnchor()
          this.selectedLine = null
        }

        // 如果是连线状态，取消连线
        if (this.isLinking) {
          this.tempLine.setAttr('visible', false)
          this.isLinking = false
          this.linePorts = []
        }

        return
      }

      // 判断是否为Group
      let group = this.findGroupParent(shape, 'model')
      if (group) {
        // 判断是否为端口
        if (shape.hasName('modelinport') || shape.hasName('modeloutport')) {
        } else {
          group.startDrag()
        }
      }
    })

    this.stage.on('mouseup', (evt) => {

    })

    this.stage.on('mousemove', (evt) => {
      this.mousePos = this.stage.getPointerPosition();
      if (this.isLinking) {
        // 更新临时连线
        this.updateTempLine()
        this.layers.link.draw()
      }
    })

    this.stage.on('dragstart', (evt) => {
      if (this.isLinking) {
        return
      }
      let target = evt.target
      if (target instanceof konva.Group) {
        let group = target
      }
    });

    this.stage.on('dragmove', (evt) => {
      if (this.isLinking) {
        return
      }

      let target = evt.target
      if (target instanceof konva.Group) {
        let group = target

        let inports = group.find('.modelinport')
        inports.each((shape) => {
          let links = shape.getAttr('linkids')
          let pos = shape.getAbsolutePosition(this.stage)

          if (links && links.length > 0) {
            for (let lid of links) {
              let link = this.layers.link.find('#' + lid)[0]
              let oldpt = link.getAttr('points').slice(-2)
              let dx = pos.x - oldpt[0]
              let dy = pos.y - oldpt[1]

              let pts = link.getAttr('points').slice(0, -2)
              pts[4] = pts[4] + dx
              pts[5] = pts[5] + dy

              pts.push(pos.x, pos.y)
              link.setAttr('points', pts)

              // 更新锚点
              if (this.selectedLine && link === this.selectedLine) {
                this.anchors[0].setAttr('points', pts)
                this.anchors[2].setAttr('x', this.anchors[2].attrs.x + dx)
                this.anchors[2].setAttr('y', this.anchors[2].attrs.y + dy)
              }
            }
          }
        })

        let outports = group.find('.modeloutport')
        outports.each( (shape) => {
          let links = shape.getAttr('linkids')
          let pos = shape.getAbsolutePosition(this.stage)

          if (links && links.length > 0) {
            for (let lid of links) {
              let link = this.layers.link.find('#' + lid)[0]
              let oldpt = link.getAttr('points').slice(0, 2)
              let dx = pos.x - oldpt[0]
              let dy = pos.y - oldpt[1]
              let pts = link.getAttr('points').slice(2)
              pts[0] = pts[0] + dx
              pts[1] = pts[1] + dy
              pts.splice(0, 0, pos.x, pos.y)
              link.setAttr('points', pts)
              // 更新锚点
              if (this.selectedLine && link === this.selectedLine) {
                this.anchors[0].setAttr('points', pts)
                this.anchors[1].setAttr('x', this.anchors[1].attrs.x + dx)
                this.anchors[1].setAttr('y', this.anchors[1].attrs.y + dy)
              }
            }
          }
        })

        this.layers.link.batchDraw()
      }
    })

    this.stage.on('dragend', (evt) => {
      if (this.isLinking) {
        return
      }
      let target = evt.target
      if (target instanceof konva.Group) {
        this.snapshot()
      }
    })
  }

  /**
   * 缓冲快照
   */
  snapshot(){

    if (this.actions.length >= this.maxAction) {
      this.actions.splice(0,1)
    }

    // 一旦添加快照，删除当前undo队列后续缓存
    if(this.actionIndex >= 0 && this.actionIndex < this.actions.length - 1){
      this.actions.splice(this.actionIndex + 1, this.actions.length - this.actionIndex - 1)
    }

    let cache = this.saveToJson()
    this.actions.push(cache)
    this.actionIndex = this.actions.length - 1
  }

  /**
   * 刷新显示
   */
  update(){
    this.stage.draw()
  }

  /**
   * 查找所在Group对象
   * @param shape
   * @param type 类型
   * @returns {*}
   */
  findGroupParent(shape, type) {
    let parent = null
    // 如果自己满足条件，返回自己
    if (shape instanceof konva.Group) {
      if ( !type || (type.length > 0 && shape.hasName(type))){
        parent = shape
        return
      }
    }

    let groups = this.stage.find('Group')
    for (let i = 0; i < groups.length; i++) {
      if (groups[i] === shape){
        continue
      }

      if (type.length > 0 && !groups[i].hasName(type) ){
        continue
      }

      if (groups[i].isAncestorOf(shape)) {
        parent = groups[i]
        break
      }
    }
    return parent
  }

  /**
   * 刷新临时连线
   */
  updateTempLine() {
    if (!this.tempLine) {
      return
    }

    let offset = this.stage.getAbsolutePosition()
    let pts = this.tempLine.getAttr('points').slice()
    pts[2] = (this.mousePos.x - offset.x)  / this.zoom
    pts[3] = (this.mousePos.y  - offset.y) / this.zoom

    let dist = Math.sqrt((pts[2] - pts[0]) * (pts[2] - pts[0]) + (pts[3] - pts[1]) * (pts[3] - pts[1]))
    if (dist < 4 ) {
      pts[2] = pts[0]
      pts[3] = pts[1]
    } else {
      pts[2] = pts[2] - (pts[2] - pts[0]) * 4.0 / dist
      pts[3] = pts[3] - (pts[3] - pts[1]) * 4.0 / dist
    }
    this.tempLine.setAttr('points', pts)
  }

  /**
   * 创建锚点
   * @param x
   * @param y
   * @returns {konva.Circle}
   */
  buildAnchor(x, y) {
    const stage = this
    let anchor = new konva.Circle({
      x: x,
      y: y,
      radius: 6,
      stroke: '#ccc',
      fill: '#999',
      strokeWidth: 1,
      draggable: true
    })

    anchor.on('mouseover', function () {
      document.body.style.cursor = 'pointer'
      this.setStrokeWidth(2)
      stage.layers.link.draw()
    })

    anchor.on('mouseout', function () {
      document.body.style.cursor = 'default'
      this.setStrokeWidth(1)
      stage.layers.link.draw()
    })

    anchor.on('dragmove', function () {
      // 更新曲线
      let x = this.attrs.x
      let y = this.attrs.y

      let lid = this.getAttr('linkid')
      let type = this.getAttr('linktype')
      if (lid) {
        let link = stage.layers.link.find('#' + lid)[0]
        let pts = link.getAttr('points').slice()

        if (type === 'start') {
          pts[2] = x
          pts[3] = y
        } else if (type === 'end') {
          pts[4] = x
          pts[5] = y
        }

        link.setAttr('points', pts)
        link.setAttr('linkmod', true) // 标记被修改过
        stage.anchors[0].setAttr('points', pts)
      }
      stage.layers.link.draw()
    })
    stage.layers.link.add(anchor)
    stage.anchors.push(anchor)
    return anchor
  }

  /**
   * 创建连线锚点
   * @param line
   */
  buildLineAnchor(line) {

    let pts = line.getAttr('points')

    let anchorline = new konva.Line({
      dash: [10, 10, 0, 10],
      strokeWidth: 2,
      stroke: '#ccc',
      lineCap: 'round',
      id: 'anchorline',
      points: pts.slice()
    })

    this.anchors.push(anchorline)
    this.layers.link.add(anchorline)

    // 显示锚点
    let a1 = this.buildAnchor(pts[2], pts[3])
    a1.setAttr('linkid', line.id())
    a1.setAttr('linktype', 'start')

    let a2 = this.buildAnchor(pts[4], pts[5])
    a2.setAttr('linkid', line.id())
    a2.setAttr('linktype', 'end')

  }

  /**
   *
   */
  hideAnchor() {
    this.anchors[0].destroy()
    this.anchors[1].destroy()
    this.anchors[2].destroy()
    this.anchors = []
  }

  /**
   * 创建临时线
   */
  createTempLine() {
    return new konva.Line({
      points: [0, 0, 0, 0],
      dash: [10, 5],
      stroke: '#333',
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
      bezier: false,
      id: 'templine',
      visible: false
    })
  }

  /**
   * 添加连线
   * @param config
   * @returns {konva.Line}
   */
  addLink(config) {
    const stage = this
    let lid = uniqid()

    let points = config.points
    if (!points || points.length < 8) {
      // 计算绝对坐标
      let outpos = config.start.getAbsolutePosition(this.stage)
      // 计算绝对坐标
      let inpos = config.end.getAbsolutePosition(this.stage)
      if (outpos.x < inpos.x) {
        points = [outpos.x, outpos.y, outpos.x + 100, outpos.y, inpos.x - 100, inpos.y, inpos.x, inpos.y]
      } else {
        points = [outpos.x, outpos.y, outpos.x + 100, outpos.y + 100, inpos.x - 100, inpos.y + 100, inpos.x, inpos.y]
      }
    }

    let line = new konva.Line({
      points: points,
      stroke: '#89abd2',
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round',
      //tension : 0.5,
      bezier: true,
      id: lid
    })

    const bindPort = (port, type) => {
      let links = port.getAttr('linkids')
      if (!links) {
        links = [lid]
      } else {
        links.push(lid)
      }
      port.setAttr('linkids', links)

      let portDef = port.getAttr('portdef')
      let model = this.findGroupParent(port, 'model')

      line.setAttr('link' + type, {
        mid: model.id(),
        port: portDef.name
      })
    }
    bindPort(config.start, 'start')
    bindPort(config.end, 'end')

    line.on('mouseover', function () {
      this.setAttr('stroke', '#ccc')
      stage.layers.link.draw()
    })

    line.on('mouseout', function (evt) {
      this.setAttr('stroke', '#89abd2')
      stage.layers.link.draw()
    });

    line.on('mouseup', function (evt) {
      if (stage.selectedLine === evt.target) {
        return
      }

      if (stage.selectedLine) {
        let mod = stage.selectedLine.getAttr('linkmod')
        if (mod) {
          stage.snapshot()
          stage.selectedLine.setAttr('linkmod', false)
        }
        stage.hideAnchor()
      }

      stage.selectedLine = evt.target
      let line = evt.target
      stage.buildLineAnchor(line)
      stage.layers.link.draw()
    })

    stage.linkIndex[lid] = line
    stage.layers.link.add(line)
    return line
  }

  /**
   *
   * @param opt
   */
  addLinkFromJson(opt){
    let startModel = this.modelIndex[opt.start.mid]
    let start = startModel.outport(opt.start.port)
    let endModel = this.modelIndex[opt.end.mid]
    let end = endModel.inport(opt.end.port)
    return this.addLink({
      start: start,
      end: end,
      points: opt.points
    })
  }

  /**
   * 创建close按钮
   */
  buildCloseButton(opt){
    // 删除按钮
    let close = new konva.Group({
      x: opt.x,
      y: opt.y,
      rotation: 45,
      name: 'modelclose'
    })

    let bg = new konva.Circle({
      x: 0,
      y: 0,
      radius: opt.size / 2,
      fill: 'transparent',
      stroke: 'transparent'
    })
    close.add(bg)

    let hline = new konva.Line({
      points: [-opt.size/2, 0, opt.size/2, 0],
      stroke: '#ddd',
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round'
    })
    close.add(hline)

    let vline = new konva.Line({
      points: [0, -opt.size/2, 0, opt.size/2],
      stroke: '#ddd',
      strokeWidth: 2,
      lineCap: 'round',
      lineJoin: 'round'
    })
    close.add(vline)
    close.setAttr('pid', opt.uid)
    close.on('mousedown', opt.action)
    return close
  }

  /**
   * 创建模型
   * @param config
   * {
   *   uid:  模型唯一ID
   *   x: X坐标
   *   y: Y坐标
   *   title: 模型标题
   *   name: 模型ID名
   *   ports: [ 端口列表
   *     {
   *       orientation: in \ out  端口方向
   *       external: true 是否暴露给外部
   *       name: 端口ID
   *       title: 端口标题
   *       dataType: 数据类型
   *     }
   *   ]
   * }
   *
   * @returns {konva.Group}
   */
  addModel(config) {
    const stage = this

    const cornerRadius = 4
    const shadowOffset = 4
    const clipOffsetX = 20
    const headHeight = 58
    const minWidth = 140
    const minContentHeight = 60

    let cfg = { uid: uniqid() }
    _.merge(cfg, config)

    // 创建模型
    let group = new konva.Group({
      x: cfg.x,
      y: cfg.y,
      draggable: true,
      name: 'model',
      id: cfg.uid
    })

    group.on('mouseover', function () {
      document.body.style.cursor = 'pointer'
    })

    group.on('mouseout', function () {
      document.body.style.cursor = 'default'
    })

    group.setAttr('modeldef', cfg)

    //头部
    let head = new konva.Group({
      x:0,
      y:0,
      name: 'modelhead',
      clip: {
        x : -clipOffsetX,
        y : -cornerRadius,
        width : minWidth + clipOffsetX * 2,
        height : headHeight + cornerRadius
      }
    })
    group.add(head)

    // 背景图形
    let headbg = new konva.Rect({
      x: 0,
      y: 0,
      width: minWidth,
      height: headHeight + cornerRadius,
      fill: '#406b95',
      stroke: '#d2e8ff',
      strokeWidth: 1,
      cornerRadius: cornerRadius,
      shadowColor: 'black',
      shadowBlur: 10,
      shadowOffset: {
        x: shadowOffset,
        y: shadowOffset
      },
      shadowOpacity: 0.6,
      name: 'modelbg'
    })
    head.add(headbg)

    // 标题
    let title = new konva.Text({
      x: 14,
      y: 12,
      text: config.title,
      fontSize: 14,
      fill: '#fff'
    })
    head.add(title)

    // Name
    let name = new konva.Text({
      x: 14,
      y: 30,
      text: config.name,
      fontSize: 12,
      fill: '#fff'
    })
    head.add(name)

    // 删除按钮
    let close = stage.buildCloseButton({
      x: minWidth - 8,
      y: 10,
      size: 10,
      uid: cfg.uid,
      action: function (evt) {
        console.log('close', evt.target)
        // 删除当前模型
        let group = stage.findGroupParent(evt.target, 'modelclose')
        let pid = group.getAttr('pid')
        stage.removeModel(pid)
        stage.snapshot()
        stage.update()
      }
    })
    head.add(close)

    // 内容
    let content = new konva.Group({
      x:0,
      y:58,
      name: 'modelhead',
      clip: {
        x : -clipOffsetX,
        y : 0,
        width : minWidth + clipOffsetX * 2,
        height : minContentHeight + clipOffsetX
      }
    })
    group.add(content)

    // 背景图形
    let contentbg = new konva.Rect({
      x: 0,
      y: -cornerRadius * 2,
      width: minWidth,
      height:  minContentHeight + cornerRadius,
      fill: '#f3faff',
      stroke: '#d2e8ff',
      strokeWidth: 1,
      cornerRadius: cornerRadius,
      shadowColor: 'black',
      shadowBlur: 10,
      shadowOffset: {
        x: shadowOffset,
        y: shadowOffset
      },
      shadowOpacity: 0.6,
      name: 'modelbg'
    })
    content.add(contentbg)

    // 绑定端口消息
    const bindPortEvent = (port) => {
      port.on('mouseover', function (evt) {
        let shape = evt.target
        shape.setAttr('fill', '#ccc')
        stage.layers.model.draw()
      })
      port.on('mouseout', function (evt) {
        let shape = evt.target
        let fill = shape.getAttr('portfill')
        shape.setAttr('fill', fill)
        stage.layers.model.draw()
      })
      port.on('mouseup', function (evt) {
        evt.cancelBubble = true
        let shape = evt.target
        let port = shape.getParent()

        if (stage.isLinking) {

          if (port === stage.linePorts[0]) {
            return
          }

          // 检测类型
          if (port.hasName('modelinport') && stage.linePorts[0].hasName('modelinport')) {
            return
          }

          if (port.hasName('modeloutport') && stage.linePorts[0].hasName('modeloutport')) {
            return
          }

          let start = null
          let end = null

          if (port.hasName('modelinport')) {
            start = stage.linePorts[0]
            end = port
          } else {
            start = port
            end = stage.linePorts[0]
          }

          // 添加连线
          stage.addLink({
            start:start,
            end: end
          })
          stage.tempLine.setAttr('visible', false)
          stage.isLinking = false
          stage.linePorts = []
          stage.snapshot()

        } else {
          // 进入连线模式
          stage.isLinking = true
          stage.linePorts[0] = port
          let pos = port.getAbsolutePosition(stage.stage)
          let pts = [pos.x, pos.y, pos.x, pos.y]
          stage.tempLine.setAttr('points', pts)
          stage.tempLine.setAttr('visible', true)
          stage.updateTempLine()
        }
        stage.layers.link.draw()
      })
    }

    // 创建端口
    let optionModel = stage.options.model
    const createPort = (opt) => {
      let port = new konva.Group({
        x: 0,
        y: 0,
        name: opt.orientation === 'in' ? 'modelinport' : 'modeloutport',
      })
      port.setAttr('portdef', opt)

      let portColor = opt.orientation === 'in' ? '#e17e1b' : '#00951b'
      let rect = new konva.Rect({
        x: 0,
        y: 0,
        width: 16,
        height: 12,
        fill: portColor,
        stroke: portColor,
        strokeWidth: 1
      });
      rect.setAttr('portfill', portColor)
      port.add(rect)

      let title = new konva.Text({
        x: 0,
        y: 0,
        text: opt[optionModel.portName],
        fontSize: 14,
        fill: '#333'
      })
      port.add(title)

      let ext = null
      if (opt.external) {
        ext = new konva.Wedge({
          x: 0,
          y: 0,
          radius: 6,
          angle: 180,
          fill: portColor,
          stroke: portColor,
          strokeWidth: 1,
          rotation: opt.orientation === 'in' ? 90 : -90
        })
        port.add(ext)
      }

      let datatype = new konva.Text({
        x: 0,
        y: 0,
        text: opt.datatype,
        fontSize: 12,
        fill: '#333',
        visible: optionModel.showDataType
      })
      port.add(datatype)

      // 调整位置
      if (opt.orientation === 'in') {
        ext && ext.position({
          x: -1,
          y: 0
        })

        rect.position({
          x: 2,
          y: -6
        })

        title.position({
          x: 20,
          y: -7
        })

        datatype && datatype.position({
          x: 20,
          y: 7
        })
      } else {
        ext && ext.position({
          x: 1,
          y: 0
        })

        rect.position({
          x: -18,
          y: -6
        })

        title.position({
          x: -20 - title.getWidth(),
          y: -7
        })

        datatype.position({
          x: -20 - datatype.getWidth(),
          y: 7
        })
      }

      // 记录最大宽度
      port.setAttr('portwidth', Math.max(title.getWidth(), datatype.getWidth()))
      bindPortEvent(rect)
      return port
    }

    // 端口分类
    let inports = []
    let outports = []
    let maxPortWidth = {
      inport: 24,
      outport: 24
    }
    if (cfg.ports && cfg.ports.length > 0){
      for( let p of cfg.ports) {
        let port = createPort(p)
        let w = +port.getAttr('portwidth')
        content.add(port)
        if (p.orientation === 'in') {
          maxPortWidth.inport = Math.max(maxPortWidth.inport, w)
          inports.push(port)
        } else {
          maxPortWidth.outport = Math.max(maxPortWidth.outport, w)
          outports.push(port)
        }
      }
    }
    let maxContentHeight = Math.max(60, Math.max(inports.length, outports.length) * 30 + 16 )
    let headWidth = Math.max(title.getWidth(), name.getWidth() + 16)
    let contentWidth = maxPortWidth.inport + maxPortWidth.outport + 60
    let maxWidth = Math.max(140, Math.max(headWidth, contentWidth))

    // adjust
    head.clipWidth(maxWidth + clipOffsetX * 2)
    headbg.width(maxWidth)
    close.position({
      x: maxWidth - 8,
      y: 10
    })

    content.clipWidth(maxWidth + clipOffsetX * 2)
    content.clipHeight(maxContentHeight + clipOffsetX)
    contentbg.size({
      width: maxWidth,
      height: maxContentHeight
    })

    let offsety = 16
    for(let inp of inports) {
      inp.position({
        x: 0,
        y: offsety
      })
      offsety += 30
    }

    offsety = 16
    for(let outp of outports) {
      outp.position({
        x: maxWidth,
        y: offsety
      })
      offsety += 30
    }

    group.inport = function(name){
      let inps = this.find('.modelinport')
      for(let p of inps){
        let def = p.getAttr('portdef')
        if (def.name === name) {
          return p
        }
      }
      return null
    }

    group.outport = function(name){
      let outps = this.find('.modeloutport')
      for(let p of outps){
        let def = p.getAttr('portdef')
        if (def.name === name) {
          return p
        }
      }
      return null
    }

    stage.layers.model.add(group)
    stage.modelIndex[cfg.uid] = group
    return group
  }

  /**
   *
   * @param opt
   */
  addModelFromJson(opt){
    this.addModel(opt)
  }

  /**
   * 删除连线
   * @param lid
   */
  removeLink(lid){
    let l = this.linkIndex[lid]
    if (!l) {
      return
    }

    const removeId = (attr) => {
      let def = l.getAttr('link' + attr)
      let m = this.modelIndex[def.mid]

      if (m) {
        let port = attr === 'start' ? m.outport(def.port) : m.inport(def.port)
        let links = port.getAttr('linkids')
        if (links) {
          links.splice(links.indexOf(lid), 1)
        }
        port.setAttr('linkids', links)
      }
    }

    removeId('start')
    removeId('end')

    delete this.linkIndex[lid]
    l.destroy()
  }

  clearModelLink(model){
    if (model instanceof konva.Group) {
      let group = model

      let inports = group.find('.modelinport')
      inports.each((shape) => {
        let links = shape.getAttr('linkids')
        if (links && links.length > 0) {
          for (let lid of links) {
           this.removeLink(lid)
          }
        }
      })

      let outports = group.find('.modeloutport')
      outports.each( (shape) => {
        let links = shape.getAttr('linkids')
        if (links && links.length > 0) {
          for (let lid of links) {
            this.removeLink(lid)
          }
        }
      })
    }
  }

  /**
   * 删除模型
   * @param mid
   */
  removeModel(mid){
    if (this.modelIndex[mid]){
      let m = this.modelIndex[mid]
      delete this.modelIndex[mid]
      // 删除连线
      this.clearModelLink(m)
      // 删除模型
      m.destroy()
    }
  }

  /**
   * 改变大小
   * @param w
   * @param h
   */
  resize(w, h){
    w && this.stage.width(w)
    h && this.stage.height(h)
    this.stage.draw()
  }

  /**
   * 放大
   */
  zoomIn(){
    if (!this.options.canZoom) {
      return
    }
    this.zoom = _.clamp(this.zoom * this.zoomFactor, this.minZoom, this.maxZoom)
    this.stage.scale({x: this.zoom, y: this.zoom})
    this.update()
  }

  zoomOut(){
    if (!this.options.canZoom) {
      return
    }
    this.zoom = _.clamp(this.zoom / this.zoomFactor, this.minZoom, this.maxZoom)
    this.stage.scale({x: this.zoom, y: this.zoom})
    this.update()
  }

  reset(){
    this.zoom = 1.0
    this.stage.scale({x: this.zoom, y: this.zoom})
    this.stage.position({
      x: 0,
      y: 0
    })
    this.update()
  }

  /**
   * 清空编辑器，不能撤销
   * @param cache boolean 是否清除快照缓冲
   */
  clear(cache = true){
    // 是否被修改
    this.modified = false
    // 当前选中连线
    this.selectedLine = null
    // 新连线端口
    this.linePorts = []
    // 是否处于连线状态
    this.isLinking = false

    // 清除缓存
    if (cache) {
      this.actions = []
      // 当前操作列表游标索引
      this.actionIndex = -1
    }

    for(let lid of Object.keys(this.linkIndex)){
      this.removeLink(lid)
    }
    for(let mid of Object.keys(this.modelIndex)){
      this.removeModel(mid)
    }

    this.modelIndex = {}
    this.linkIndex = {}
  }

  /**
   * 加载模型
   * @param data 快照数据
   * @param cache  boolean 是否清除快照缓冲
   */
  loadFromJson(data, cache = true){
    // 清空面板
    this.clear(cache)

    if(!data){
      return
    }

    // 加载模型
    if (data.models){
      for(let m of data.models){
        this.addModelFromJson(m)
      }
    }

    // 加载连线
    if (data.links){
      for(let l of data.links){
        this.addLinkFromJson(l)
      }
    }

    // 如果清除之前缓存，则重新构建新缓存
    if(cache){
      this.snapshot()
    }

    this.update()
  }

  /**
   * 保存模型
   */
  saveToJson() {
    let json = {
      models:[],
      links:[]
    }

    // 记录模型
    for(let m of Object.values(this.modelIndex)){
      let cfg = _.cloneDeep(m.getAttr('modeldef'))
      cfg.x = m.position().x
      cfg.y = m.position().y
      json.models.push(cfg)
    }

    // 记录连线
    for(let l of Object.values(this.linkIndex)){
      json.links.push({
        start: _.cloneDeep(l.getAttr('linkstart')),
        end: _.cloneDeep(l.getAttr('linkend')),
        points: _.cloneDeep(l.getAttr('points'))
      })
    }

    return json
  }

  /**
   * 是否有undo
   * @returns {boolean}
   */
  hasUndo(){
    return this.actions.length > 1 && this.actionIndex > 0
  }

  /**
   * 撤销
   */
  undo(){
    if (this.actions.length <= 1) {
      this.actionIndex = this.actions.length - 1
      return
    }

    if (this.actionIndex < 0) {
      this.actionIndex = this.actions.length - 1
    }

    if (this.actionIndex > 0){
      this.actionIndex -= 1
      let cache = this.actions[this.actionIndex]
      // 加载之前缓冲（保留缓冲队列）
      this.loadFromJson(cache, false)
    }
  }

  /**
   * 是否有redo
   * @returns {boolean}
   */
  hasRedo() {
    return this.actionIndex >= 0 && (this.actionIndex < this.actions.length - 1)
  }

  /**
   * 重做
   */
  redo(){
    if (this.actionIndex < 0) {
      return
    }

    if (this.actionIndex < this.actions.length - 1){
      this.actionIndex += 1
      let cache = this.actions[this.actionIndex]
      // 加载之前缓冲（保留缓冲队列）
      this.loadFromJson(cache, false)
    }

  }

}

export default Stage