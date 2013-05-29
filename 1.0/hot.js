KISSY.add(function (S, Node , Event , Io , Tpl){
    var EVT_SELECT = 'select';
    var EVT_QUERY = 'afterQueryChange';

    var CLS_ITEM = 'J_AcItem';
    var CLS_ACTIVE = 'ks-ac-hot-selected';

    var SELECTOR_ITEM = '.' + CLS_ITEM;
    var SELECTOR_TAB = '.J_TabItem';

    var AutoCompleteHot = function (){};
    AutoCompleteHot.ATTRS = {
        /**
         * 热门推荐模板
         * @cfg {String}
         */
        hotTemplate : {
            value : '<div class="ks-ac-hot-city"><div class="ks-ac-acinput-hot-tit">热门城市/国家(支持汉字/拼音/英文字母)</div>' +
                '<ul class="tab-nav">{{#results}}<li class="J_TabItem">{{tabname}}</li>{{/results}}</ul>' +
                '<div class="tab-content J_TabContent">{{#results}}' +
                '<div class="tab-pannel J_Pannel">{{#tabdata}}<dl><dt>{{dt}}</dt><dd>{{#dd}}<span><a data-sid="{{sid}}" class="J_AcItem" tabindex="-1" href="javascript:void(0);" target="_self">{{cityName}}</a></span>{{/dd}}</dd></dl>{{/tabdata}}</div>{{/results}}</div></div>'
        },
        /**
         * 热门推荐城市数据源接口,支持JSONP和本地数据
         * @cfg {String|Object}
         */
        hotSource : {
            value : null,
            setter : '_onHotSourceChange'
        },
        /**
         * 热门推荐的callback函数名 IO专用
         * @cfg {String}
         */
        hotJsonpCallback : {
            value :'callback'
        },
        /**
         * 当前热门推荐被选中tab
         * @cfg {Number}
         */
        hotActiveTab : {
            value : null
        },
        /**
         * 热门数据格式化
         * @cfg {Function}
         */
        hotResultsFormatter : {
            value : null
        },
        /**
         * 热门推荐区域宽度设置
         * @cfg {Number}
         */
        hotWidth : {
            value : 320
        },
        /**
         * 处理数据层和UI层绑定需要用到的键值对
         * @cfg {Function}
         */
        hotResultsLocator : {
            value : function (data){
                var results = {};
                S.each(data.results,function (_iObj){
                    S.each(_iObj.tabdata , function (_jObj){
                        S.each(_jObj.dd , function (_kObj){
                            var id = 'hot_source_id_'+ S.guid();
                            _kObj.raw = S.mix({}, _kObj);
                            _kObj.sid = id;
                            _kObj.text = _kObj.cityName;
                            results[id] = _kObj;
                        })
                    });
                });
                return results;
            }
        },
        /**
         * 热门推荐的状态
         */
        hotVisible : {
            value : false
        }
    };
    AutoCompleteHot.prototype = {
        initializer : function (){
            if (this.get('hotSource') === null) {
                return ;
            }
            this._renderHot();
            this._bindHot();
            this._hasBuildHot  = false;//是否初始化过热门数据
            this._hotResults = {};
        },
        destructor : function (){
            this.hotNode.detach();
        },
        _renderHot : function (){

        },
        _bindHot : function (){
            var input_node = this.get('inputNode');

            this.on('afterHotVisibleChange' , function (e){
                var isShowIt = e.newVal;
                if (isShowIt) {
                    if (!this._hasBuildHot) {
                        this._buildHot();
                    }
                    this.hotNode.show();
                    this.overlay.set('width',this.get('hotWidth'));
                    this.set('resultsListVisible' , false);
                    this.set('visible' , true);
                }else{
                    this.hotNode.hide();
                }
            },this);
            this.on('afterVisibleChange', function (e){
                if (e.newVal === false) {
                    this.set('hotVisible' , false);
                }
            }, this);
            //展示推荐结果时不展示热门推荐
            this.on('afterResultsListVisibleChange' , function (e){
                if (e.newVal) {
                    this.set('hotVisible' , false);
                }
            }, this);
            input_node.on('focus', function (){
                if (this._isSelectVal) {
                    return;
                }
                this.set('hotVisible' , true);
            },this);
            this.on(EVT_QUERY , function (e){
                if (S.trim(e.newVal.query) === '') {//输入框为空时展示热门推荐
                    this.set('messageVisible' , false);
                    this.set('hotVisible' , true);
                }else{
                    this.set('hotVisible' , false);
                }
            } , this);

            //点击选择项
            this.hotNode.delegate('click' , SELECTOR_ITEM , function (e){
                var el = S.one(e.currentTarget);
                this.fire(EVT_SELECT , {
                    node : el,
                    result : this._hotResults[el.attr('data-sid')]
                })
            },this);

            //tab 切换
            this.hotNode.delegate('click' , SELECTOR_TAB , function (e){
                var index = S.indexOf(e.currentTarget , this.hotNavNodes);
                this.set('hotActiveTab' , index);
            },this);

            this.on('afterHotActiveTabChange' , function (e){
                var _prevNav = this.hotNavNodes.item(e.prevVal);
                var _prevPannel = this.hotPannelNodes.item(e.prevVal);
                var _nextNav = this.hotNavNodes.item(e.newVal);
                var _nextPannel = this.hotPannelNodes.item(e.newVal);
                _prevNav && _prevNav.removeClass(CLS_ACTIVE);
                _prevPannel && _prevPannel.hide();
                _nextNav && _nextNav.addClass(CLS_ACTIVE);
                _nextPannel && _nextPannel.show();
            },this);

            //在热门推荐按下esc时触发隐藏
            this.hotNode.on('keydown', function (e){
                if (e.keyCode === 27) {
                    this.set('visible',false);
                }
            },this);
        },
        /**
         * 初始化热门推荐
         * @private
         */
        _buildHot : function (){
            var that = this;
            var source = this.get('hotSource');
            /**
             * HOT的渲染
             * @param data 依赖的数据源
             * @private
             */
            var _build = function (data){
                var locator = that.get('hotResultsLocator');
                data = that._parseHotResponse(data);
                that._hotResults = locator.call(this, data);
                var html = new Tpl(that.get('hotTemplate')).render(data);
                var hot_node = that.hotNode;
                hot_node.html(html);
                that.hotNavNodes = hot_node.all('.J_TabItem');
                that.hotPannelNodes = hot_node.all('.J_Pannel');
                that.hotPannelNodes.hide();
                that.set('hotActiveTab',0);
                that._hasBuildHot = true;
            };
            if (S.isString(source)) {
                S.IO({
                    url : source,
                    dataType : 'jsonp',
                    jsonp : this.get('hotJsonpCallback'),
                    success : function (data){
                        _build(data);
                    }
                });
            }else if(S.isObject(source) || S.isArray(source)){
                _build(source);
            }
        },
        _parseHotResponse : function (results){
            var formatter = this.get('hotResultsFormatter');
            if (formatter && S.isFunction(formatter)) {
                results = formatter.call(this,results);
            }
            return results;
        },
        /**
         * 修改hotSource时重置HOT的状态
         * @private
         */
        _onHotSourceChange : function (){
            this._hasBuildHot = false ;
            this._hotResults = {};
            this.set('hotActiveTab' , -1);
        }
    };
    return AutoCompleteHot ;
}, {requires : ['node','event','ajax' , 'xtemplate']});