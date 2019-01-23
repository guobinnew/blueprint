<template>
    <div class="container" v-resize="onContainerResize">
        <div id="scene"></div>
        <div class="menu">
            <el-row>
                <el-button-group>
                    <el-button type="primary" icon="el-icon-edit" @click="zoomIn">放大</el-button>
                    <el-button type="primary" icon="el-icon-share" @click="zoomOut">缩小</el-button>
                    <el-button type="primary" icon="el-icon-delete" @click="reset">重置</el-button>
                    <el-button type="primary" icon="el-icon-delete" @click="load">加载</el-button>
                    <el-button type="primary" icon="el-icon-delete" @click="save">保存</el-button>
                    <el-button type="primary" icon="el-icon-delete" @click="undo">撤销</el-button>
                    <el-button type="primary" icon="el-icon-delete" @click="redo">重做</el-button>
                    <el-button type="primary" icon="el-icon-delete" @click="clear">清空</el-button>
                    <el-button type="primary" icon="el-icon-delete" @click="autoLink">自动连线</el-button>
                </el-button-group>
            </el-row>
        </div>
    </div>
</template>

<style scoped>
    .container {
        overflow: hidden;
        height: 100%;
        line-height: 40px;
    }

    #scene {
        width: 100%;
        height: 100%;
        background-color: #fff;
    }

    .menu {
        position: absolute;
        top: 0;
        left: 0;
        overflow: visible;
        text-align: left;
        margin-left: 100px;
        margin-top: 10px;
    }

</style>

<script>
  import resize from 'vue-resize-directive'
  import Blueprint from '../components/blueprint/index'

  export default {
    data: function () {
      return {
        size: {
          width: 0,
          height: 0
        },
        scene: {
          stage: null,
          cache: null
        }
      }
    },
    directives: {
      resize,
    },
    computed: {

    },
    methods: {
      onContainerResize() {
        this.size.width = this.$el.clientWidth
        this.size.height = this.$el.clientHeight
        this.scene.stage.resize(this.size.width, this.size.height)
      },
      zoomIn(){
        this.scene.stage.zoomIn()
      },
      zoomOut(){
        this.scene.stage.zoomOut()
      },
      reset(){
        this.scene.stage.reset()
      },
      load(){
        this.scene.stage.loadFromJson(this.cache)
      },
      save(){
        this.cache = this.scene.stage.saveToJson()
        console.log(this.cache)
      },
      undo(){
        this.scene.stage.undo()
      },
      redo(){
        this.scene.stage.redo()
      },
      clear(){
        this.scene.stage.clear()
      },
      autoLink(){
        this.scene.stage.autoLink()
      },
      test(){
        let g1 = this.scene.stage.addModel({
          name: 'ComponentA',
          title: '组件A',
          version: 'V1.0.0',
          x: 200,
          y: 200,
          ports: [
            {
              orientation: 'in',
              external: true,
              name: 'LocationX',
              datatype: 'float',
              version: 'V1'
            },
            {
              orientation: 'in',
              external: true,
              name: 'LocationY',
              datatype: 'float',
              version: 'V2'
            },
            {
              orientation: 'in',
              external: true,
              name: 'canNotify',
              datatype: 'bool',
              version: 'V2'
            },
            {
              orientation: 'out',
              name: 'Distance',
              datatype: 'float',
              version: 'V1'
            }
          ]
        })

        let g2 = this.scene.stage.addModel({
          title: '组件B',
          name: 'ComponentB',
          x: 500,
          y: 300,
          ports: [
            {
              orientation: 'in',
              name: 'Distance',
              datatype: 'float',
              version: 'V1'
            },
            {
              orientation: 'out',
              external: true,
              name: 'Time',
              datatype: 'float',
              version: 'V3'
            },
            {
              orientation: 'out',
              name: 'canNotify',
              datatype: 'bool',
              version: 'V2'
            }
          ]
        })

        let start = g1.outport('Distance')
        let end = g2.inport('Distance')
        this.scene.stage.addLink({
          start: start,
          end: end
        })
        this.scene.stage.snapshot()
        this.scene.stage.update()
      }
    },
    mounted: function () {
      // 随窗口动态改变大小
      this.size.width = this.$el.clientWidth
      this.size.height = this.$el.clientHeight

      this.scene.stage = Blueprint.init({
        container: 'scene',    //container 用来容纳舞台的容器
        width: this.size.width,
        height: this.size.height
      })

      // 测试
      this.test()
    }
  }
</script>
