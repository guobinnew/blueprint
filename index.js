import Stage from './stage'

const Blueprint = {
  /**
   * 创建编辑面板
   * @param options
   * {
   *    container: 'scene',    //用来容纳的DOM节点Id（必须有）
   *    width:  // canvas宽度（必须有）
   *    height: // canvas高度（必须有）
   *    draggable: false  // 是否允许内容拖放
   *    canZoom: true,  // 是否允许缩放
   *    canWheelZoom: true // 是否允许滚轮缩放
   *    model:
   *    {
   *      portName: string // 用于显示端口名称的字段 默认为name
   *      showDataType: true  // 是否显示端口类型
   *    }
   * }
   * @returns {Stage}
   */
  init: function(options){
   return new Stage(options)
  }
}

export default Blueprint