/*
combined files : 

gallery/autocomplete/1.0/base
gallery/autocomplete/1.0/rich
gallery/autocomplete/1.0/hot
gallery/autocomplete/1.0/index

*/
KISSY.add('gallery/autocomplete/1.0/base',function (S){
    var INPUT_NODE = 'inputNode';

    var QUERY = 'query';
    var RESULTS = 'results';
    var EVT_RESULTS = 'results';
    var EVT_QUERY = 'afterQueryChange' ;
    var VALUE_CHANGE = 'valuechange';
    var REQUEST_TEMPLATE = 'requestTemplate';
    var RESULT_LIST_LOCATOR = 'resultListLocator';

    function AutoCompleteBase(){
    }
    AutoCompleteBase.ATTRS = {
        /**
         * 使用缓存，当source是后端提供的数据接口时，将同样的请求做缓存
         */
        enableCache : {
            value : true
        },
        inputNode : {
            value : null,
            setter : function (el){
                if (el instanceof S.NodeList) {
                    return el;
                }
                return S.one(el);
            }
        },
        /**
         * 允许返回的最大值，设置为0表示不限制
         */
        maxResults:{
            value : 1000
        },
        /**
         * 最小查询字符串长度，输入框的值为空时，不进行查询
         */
        minQueryLength : {
            value : 1
        },
        /**
         * jsonp 请求的callback的NAME设定,默认为callback
         */
        jsonpCallback : {
            value : 'callback'
        },
        query : {
            value : null
        },
        /**
         * 延时查询,避免用户连续输入时密集发送查询请求
         */
        queryDelay : {
            value : 100
        },
        /**
         * 查询字符分隔符,如果配置了这个值，将以此作为分隔符将输入框的值分割为数组，取数组的最后一个值作为查询参数.
         * 用于输入框支持多项输入
         */
        queryDelimiter : {
            value : null
        },
        /**
         * 数据源的请求模板.
         * @type String
         */
        requestTemplate : {
            value : null,
            setter : '_setRequestTemplate'
        },
        /**
         * 数据结果过滤
         * @type Array
         */
        resultFilter : {
            value : null
        },
        /**
         * 数据结果初始化
         * @type : Function
         */
        resultFormatter : {
            value : null
        },
        /**
         * 搜索结果高亮处理函数
         * @type {Function}
         */
        resultHighlighter : {
            value : null ,
            setter : '_setResultHighlighter'
        },
        /**
         * 数据结果返回时的第一个处理函数，指定数组位置
         * @type {Function|String}
         */
        resultListLocator : {
            value : null ,
            setter : '_setLocator'
        },
        /**
         * 存储当前的查询结果
         */
        results : {
            value : []
        },
        /**
         * 在触发选择后，对当前文本的操作
         */
        resultTextLocator:{
            value : null,
            setter : '_setLocator'
        },
        /**
         * 数据源
         */
        source : {
            value : null,
            setter : '_setSource'
        },
        /**
         * 设置输入框的值,可以用于区分是用户通过UI输入造成的valueChange还是代码通过 setValue()改变的输入框的值
         */
        value : {
            value : '',
            setter : '_onSetValue'
        },
        /**
         * 是否打开浏览器默认行为
         */
        allowBrowserAutocomplete : {
            value : false
        }
    };
    AutoCompleteBase.prototype = {
        initializer : function (){
            if (this.get('enableCache') === true) {
                this._cache = {};
            }
            this.inputNode = this.get('inputNode');
            if (!this.inputNode) {
                S.log('error: 没有对应的输入框节点.');
                return false;
            }
            this._renderUIAcBase();
            this._bindUIAcBase();
            return this;
        },
        destructor : function (){
            var input_node = this.get('inputNode');
            input_node.detach();
        },
        /**
         * 渲染组件
         * @private
         */
        _renderUIAcBase : function (){
            this._syncBrowserAutocomplete();
        },
        /**
         * 事件处理中心
         * @private
         */
        _bindUIAcBase : function (){
            var input_node = this.get(INPUT_NODE);
            input_node.on(VALUE_CHANGE , this._onInputValueChange , this);
            this.on('afterValueChange' , this._afterValueChange , this);

            this.on(EVT_QUERY,function (e){
                var query = S.trim(e.newVal.query);
                if (query.length < this.get('minQueryLength')) {//小宇最短字符时不做处理
                    return ;
                }
                this.sendRequest(query);
            },this);

            this.on('afterAllowBrowserAutocompleteChange' , this._syncBrowserAutocomplete , this);
        },
        /**
         * query 事件后默认出发函数
         * @param query
         * @param requestTemplate
         */
        sendRequest : function (query , requestTemplate){
            var request ;
            var source = this.get('source');
            if (source) {
                if (!requestTemplate) {
                    requestTemplate = this.get(REQUEST_TEMPLATE);
                }
                request = requestTemplate ? requestTemplate.call(this,query) : query;
                source.sendRequest({
                    query : query ,
                    request : request,
                    callback : {
                        success : S.bind(this._onResponse , this , query)
                    }
                });
            }
        },
        _onSetValue : function (val){
            this.get('inputNode').val(val);
        },
        _onInputValueChange : function (e){
            this.set('value' , e.newVal ,{
                silent : false
            });
        },
        /**
         * 实力的 value 属性被set后触发
         * @private
         */
        _afterValueChange : function (e){
            var that = this;
            var val = e.newVal;
            var delimiter = this.get('queryDelimiter');
            var query= val;
            var arr;
            if (delimiter !== null) {
                arr = val.split(delimiter);
                query = arr[arr.length - 1];
            }
            var _setQuery = function (){
                that.set(QUERY,{
                    query : query,
                    inputValue : val
                });
            };
            var delay = this.get('queryDelay');

            if (delay) {
                clearTimeout(this._delay);
                this._delay = setTimeout(function (){
                    _setQuery();
                },delay);
            }else{
                _setQuery();
            }
        },
        _updateValue : function (newVal){
            var delim = this.get('queryDelimiter'),
                insertDelim,
                len,
                prevVal;
            newVal = S.trim(newVal);
            if (delim) {
                insertDelim = S.trim(delim); // so we don't double up on spaces
                prevVal     = S.map(S.trim(this.get('value')).split(delim), function (item){
                    return S.trim(item);
                });
                len         = prevVal.length;

                if (len > 1) {
                    prevVal[len - 1] = newVal;
                    newVal = prevVal.join(insertDelim);
                }

                newVal = newVal + insertDelim;
            }

            this.set('value' , newVal,{
                silent : true//不通过afterValueChange去触发query事件
            });
        },
        /**
         * 数据查询返回结果后，对数据进行过滤排序，文本替换,高亮等操作
         * @private
         */
        _onResponse : function (query , e){
            if (query === (this.get('query').query || '')) {
                this._parseResponse(query || '', e.response, e.data);
            }
        },
        _parseResponse: function (query , response , data) {
            var facade = {
                    data   : data,
                    query  : query,
                    results: []
                },

                listLocator = this.get(RESULT_LIST_LOCATOR),
                results = [],
                unfiltered = response && response.results,
                formatted,
                formatter,
                filter,
                i,
                len,
                maxResults,
                result,
                text,
                textLocator;
            if (unfiltered && listLocator) {//指定返回结果的数组路径
                unfiltered = listLocator.call(this, unfiltered);
            }

            if (unfiltered && unfiltered.length) {
                textLocator = this.get('resultTextLocator');
                filter = this.get('resultFilter');
                // Create a lightweight result object for each result to make them
                // easier to work with. The various properties on the object
                // represent different formats of the result, and will be populated
                // as we go.
                for (i = 0, len = unfiltered.length; i < len; ++i) {
                    result = unfiltered[i];
                    text = textLocator ?
                        textLocator.call(this, result) :
                        result.toString();

                    results.push({
                        display: text,
                        raw    : result,
                        text   : text
                    });

                }
                if (filter) {
                    results = filter.call(this, query , results.concat());
                }
                if (results.length) {
                    formatter = this.get('resultFormatter');
                    maxResults = this.get('maxResults');

                    //最大数据条数的限制
                    if (maxResults && maxResults > 0 &&
                        results.length > maxResults) {
                        results.length = maxResults;
                    }
                    if (formatter) {
                        formatted = formatter.call(this, query, results.concat());
                        if (!formatted) {
                            S.log("Formatter didn't return anything.", 'warn', 'autocomplete-base');
                        }else{
                            for (i = 0, len = formatted.length; i < len; ++i) {
                                results[i].display = formatted[i];
                            }
                        }
                    }
                }
            }

            facade.results = results;
            this.set(RESULTS , results);
            this.fire(EVT_RESULTS, facade);
        },
        /**
         * 数据返回成功后的回调处理方法
         * @param data
         * @param request
         * @private
         */
        _sourceSuccess : function (data , request){
            request.callback.success({
                data : data ,
                response : {
                    results : data
                },
                request : request
            });
        },
        /**
         * setter 启用缓存
         * @private
         */
        _setEnableCache : function (value){
            if (value === true) {
                this._cache = {};
            }
        },
        _setRequestTemplate : function (template){
            if (S.isFunction(template)) {
                return template.call(this, query);
            }
            return function (query){
                return S.substitute(template , {
                    query : encodeURIComponent(query)
                });
            }
        },
        _setResultFilter : function (query , results){
            return results;
        },
        _setResultHighlighter : function (highlighter){
            if (S.isFunction(highlighter)) {
                return highlighter;
            }
            return false;
        },
        _setLocator : function (locator){
            if (S.isFunction(locator)) {
                return locator;
            }
            locator = locator.toString().split('.');
            var getObjVal = function (obj,path){
                if (!obj) {
                    return null;
                }
                for(var i=0 , len = path.length ;i < len ; i++){
                    if (path[i] in obj) {
                        obj = obj[path[i]];
                    }
                }
                return obj;
            };
            return function (result){
                return result && getObjVal(result , locator);
            };
        },
        _setSource : function (source){
            switch (true){
                case S.isString(source) :
                    return this._createJsonpSource(source);
                    break;
                case S.isFunction(source) :
                    return this._createJsonpSource(source);
                    break;
                case S.isObject(source) :
                    return this._createObjectSource(source);
                    break;
                default :
                    break;
            }
            return source;
        },
        /**
         * jsonp格式的数据源
         * @param {String} source
         */
        _createJsonpSource : function (source){
            var jsonp_source = {
                type : 'jsonp'
            };
            var that = this ;
            var last_request ;
            var requestTemplate = this.get(REQUEST_TEMPLATE);
            if (requestTemplate) {
                source += requestTemplate.call(this,query);
            }
            jsonp_source.sendRequest = function (request){
                last_request = request ;
                var cacheKey = request.request;
                if (that._cache && cacheKey in that._cache) {//从缓存获取数据
                    that._sourceSuccess(that._cache[cacheKey],request);
                    return ;
                }
                var url;
                url = S.substitute(source , {
                    query : request.query,
                    maxResults: that.get('maxResults')
                });
                S.IO({
                    url : url,
                    dataType : 'jsonp',
                    jsonp : that.get('jsonpCallback'),
                    success : function (data){
                        if (last_request === request) {//仅处理最后一次请求
                            that._cache && (that._cache[request.request] = data);
                            that._sourceSuccess(data , request);
                        }
                    }
                });
            };
            return jsonp_source;
        },
        _createArraySource : function (source){
            var that = this;
            return  {
                type : 'Array',
                sendRequest : function (request){
                    that._sourceSuccess(source , request);
                }
            };
        },
        _createObjectSource : function (source){
            var that = this;
            return  {
                type : 'Object',
                sendRequest : function (request){
                    that._sourceSuccess(source , request);
                }
            };
        },
        /**
         * 设置autocomplete属性，关闭浏览器默认的自动完成功能
         * @private
         */
        _syncBrowserAutocomplete : function (){
            var input_node = this.get('inputNode');
            if (input_node.prop('nodeName').toLowerCase() === 'input') {
                input_node.attr('autocomplete' , this.get('_syncBrowserAutocomplete') ? 'on' : 'off');
            }
        }
    };
    return AutoCompleteBase;
},{requires : ['node','base']});
/**
 * RICH 包含UI所有交互逻辑
 */
KISSY.add('gallery/autocomplete/1.0/rich',function (S ,Node , Event , O){
    var QUERY = 'query';
    var RESULT = 'result';

    var EVT_QUERY = 'afterQueryChange';
    var EVT_RESULTS = 'results';
    var EVT_SELECT = 'select';

    var ACTIVE_ITEM = 'activeItem';
    var HOVER_ITEM = 'hoverItem';

    var CLS_ACTIVE = 'ks-ac-active';
    var CLS_HOVER = 'ks-ac-hover';
    var CLS_ITEM = 'J_AcItem';
    var CLS_AC_CONTAINER = 'ks-autocomplete';
    var CLS_AC_INPUT = 'ks-autocomplete-input';

    var SELECTOR_ITEM = '.' + CLS_ITEM;

    var isArray = S.isArray;
    var doc = document;
    var body = doc.body;
    var DOM = S.DOM;
    var win = window;


    var AutoCompleteRich = function (){
    };
    AutoCompleteRich.ATTRS = {
        /**
         * {Numberic || NodeList || 'this'} 'this'表示宽度和输入框保持一致
         */
        width:{
            value : null,
            getter : '_getWidth'
        },
        /**
         * 在输入框失去焦点时有推联想搜索结果，启用自动回填当前被激活的数据项
         */
        enableAutoFill : {
            value : true
        },
        /**
         * 默认激活第一个候选项
         */
        activeFirstItem: {
            value: true
        },
        /**
         * 当前的激活项
         */
        activeItem : {
            value : null
        },
        /**
         * 当前的HOVER项
         */
        hoveredItem: {
            readOnly: true,
            value: null
        },
        /**
         * overlay的visible
         */
        visible : {
            value : false
        },
        /**
         * 推荐结果的可见状态
         */
        resultsListVisible : {
            value : false
        },
        /**
         * message的可见状态
         */
        messageVisible : {
            value : false
        },
        /**
         * 对齐配置
         */
        align : {
            value : {
                node : null,
                points : ['bl', 'tl'],
                offset : [0,-1],
                overflow:{
                    adjustX: 0, // 当对象不能处于可显示区域时，自动调整横坐标
                    adjustY: 0// 当对象不能处于可显示区域时，自动调整纵坐标
                }
            }
        },
        /**
         * 最外层容器HTML片段
         */
        boundingBoxTemplate : {
            value: '<div class="ks-ac-header"></div>' +
                '<div class="ks-ac-body">' +
                '   <div class="ks-ac-message J_AcMessage"></div>' +
                '   <div class="ks-ac-content J_AcContent">' +
                '       <div class="J_HotList"></div>' +
                '       <div class="J_ResultsList"></div>' +
                '   </div>' +
                '</div>' +
                '<div class="ks-ac-footer"><span></span></div>'
        },
        listNodeTemplate : {
            value : '<div class="ks-ac-list"></div>'
        },
        itemNodeTemplate : {
            value : '<div class="ks-ac-item"></div>'
        },
        noResultsMessage : {
            value : '没有"<span class="ks-ac-message-hightlight">{query}</span>"相关的推荐'
        },
        /**
         * {NodeList} clickoutside的范围元素
         */
        trigger : {
            value : []
        }
    };
    AutoCompleteRich.prototype = {
        overlay        : null,//overlay实例
        overlayNode    : null,//提示层根节点
        contentNode    : null,//内容节点
        resultsListNode: null,//推荐结果的节点
        messageNode    : null,//错误信息节点
        hotNode        : null,//热门推荐节点
        headerNode     : null,//头部节点
        footerNode     : null,//尾部节点
        initializer : function (){
            this._renderRich();
            this._bindRich();
        },
        destructor : function (){
            this.resultsListNode.detach();
            this.detach();
            this.overlay = null;
        },
        _renderRich : function (){
            var input_node = this.get('inputNode');
            var _align = this.get('align');
            _align.node = input_node;
            this.set('align', _align);
            input_node.addClass(CLS_AC_INPUT);
            //基于overlay组件
            var overlay = this.overlay = new O({
                align:this.get('align'),
                content : this.get('boundingBoxTemplate')
            });
            overlay.render();
            var el = overlay.get('el');
            this.overlayId = 'J_Ks'+ S.guid();
            el.prop('id' , this.overlayId).addClass(CLS_AC_CONTAINER).attr('tabindex','-1');
            this.overlayNode = el;
            this.headerNode = el.one('.J_AcHeader');
            this.bodyNode = el.one('.J_AcBody');
            this.footerNode = el.one('.J_AcFooter');
            this.messageNode = el.one('.J_AcMessage').hide();
            this.contentNode = el.one('.J_AcContent');
            this.hotNode = el.one('.J_HotList').hide();
            this.resultsListNode = el.one('.J_ResultsList').hide();
            S.one(win).on('resize',  S.buffer(this._syncPosition , 100 , this), this);
        },
        /**
         * 生成搜索结果列表
         * @param items 列表所依赖的数据
         * @returns {NodeList} 返回documentFragment;
         */
        _buildList : function (items){
            var listNode = S.one(S.DOM.create(this.get('listNodeTemplate')));
            S.each(items,function (_item){
                listNode.append(this._createItemNode(_item).data(RESULT,_item));
            },this);
            return listNode;
        },
        /**
         * 创建搜索结果的子项
         * @param item
         * @returns {*}
         * @private
         */
        _createItemNode : function (item){
            var node = S.one(DOM.create(this.get('itemNodeTemplate')));
            node.addClass(CLS_ITEM).append(item.display);
            return node;
        },
        /**
         * 绑定事件
         * @private
         */
        _bindRich : function (){
            var input_node = this.get('inputNode');

            //同步状态
            this.on('afterVisibleChange',this._afterVisibleChange, this);
            this.on('afterResultsListVisibleChange',this._afterResultsListVisibleChange, this);
            this.on('afterMessageVisibleChange' , this._afterMessageVisibleChange, this);

            input_node.on('keydown', S.bind(this._afterKeyDown ,this));
            input_node.on('focus' , this._onFocus, this);

            this.on(EVT_RESULTS , S.bind(this._onResults , this));
            this.on(EVT_QUERY, this._onQuery,this);
            this.on('afterActiveItemChange' , S.bind(this._afterActiveChange , this));
            this.on('afterHoverItemChange', S.bind(this._afterHoverChange,this));


            //event of select
            this.on(EVT_SELECT , this._onSelect, this);

            //clickoutside
            var doc_node = S.one(doc);
            var clickoutside_handler = S.bind(this._afterDocClick,this);
            this.overlay.on('afterVisibleChange',function (e){
                if(e.newVal){//展示时 绑定outclick事件
                    doc_node.on('click', clickoutside_handler);
                    return ;
                }
                //隐藏时 取消监听
                doc_node.detach('click', clickoutside_handler);
            }, this);
            this.bindList();
        },
        /**
         * 搜索结果列表事件绑定
         */
        bindList : function (){
            this.resultsListNode.delegate('mouseenter' ,SELECTOR_ITEM , function (e){
                var item = S.one(e.currentTarget);
                this.hoverItem(item);
            },this);
            this.resultsListNode.delegate('click' , SELECTOR_ITEM , function (e){
                e.preventDefault();
                var item = S.one(e.currentTarget);
                this.selectItem(item);
            },this);
            this.resultsListNode.on('mouseleave' , function (){
                this.set(HOVER_ITEM,null);
            },this);
        },
        /**
         * 搜索结果返回时响应
         * @param e
         * @private
         */
        _onResults : function (e){
            var resluts = e.results ;
            var query = e.query ;
            var list_node =  this.resultsListNode;

            if (this._isSelectVal) {
                return ;
            }
            if (isArray(resluts) && resluts.length > 0) {
                this._clear();
                list_node.empty();
                list_node.append(this._buildList(resluts));
                this.set('messageVisible', false);
                this.get('activeFirstItem') && this.set(ACTIVE_ITEM, this._getFirstItem());
                doc.activeElement  == this.inputNode[0]  && this.set('resultsListVisible' , true);//焦点还在输入框时才进行现实
            }else{
                query = S.escapeHTML(query);
                doc.activeElement  == this.inputNode[0]  && this.showMessage(S.substitute(this.get('noResultsMessage'),{//焦点还在输入框时才进行显示
                    query : query
                }))
            }

        },
        /**
         * 显示消息
         * @param msg
         */
        showMessage : function (msg){
            this.messageNode.html(msg);
            var that = this;
            setTimeout(function (){
                that.set('messageVisible', true);
            },1);
        },
        /**
         * 重新定位容器对齐
         * @private
         */
        _syncPosition : function (){
            var _align = this.get('align');
            this.overlay.align(_align.node , _align.points , _align.offset , _align.overflow);
        },
        /**
         * 重置results list的状态
         * @private
         */
        _clear : function (){
            this.set(ACTIVE_ITEM , null);
            this.set(HOVER_ITEM , null);
        },
        selectItem : function (item_node){
            if (!item_node) {
                item_node = this.get(ACTIVE_ITEM);
            }
            var result = item_node.data(RESULT);
            this.fire(EVT_SELECT,{
                node : item_node,
                result : result
            });
            return this;
        },
        /**
         * 同步状态
         * @param e
         * @private
         */
        _afterVisibleChange : function (e){
            var isShowIt = e.newVal;
            this._syncPosition();
            if (isShowIt) {
                this.overlay.show();
            }else{
                this.overlay.hide();
            }
        },
        _afterResultsListVisibleChange : function (e) {
            var isShowIt = e.newVal;
            if (isShowIt) {
                this.overlay.set('width', this.get('width'));
                this.resultsListNode.show();
                this.set('visible', true);
            } else {
                this.resultsListNode.hide();
            }

            //自动回填:输入框失去焦点时如果有推荐结果被选中则自动回填
            if (this.get(QUERY).query !== '' && e.newVal === false && this.get('enableAutoFill')  && this.get(ACTIVE_ITEM)) {
                this.selectItem();
            }
        },
        _afterMessageVisibleChange : function (e){
            var isShowIt = e.newVal;
            if (isShowIt) {
                this.overlay.set('width', this.get('width'));
                this.messageNode.show();
                this.set('visible', true);
            } else {
                this.messageNode.hide();
                this.set('visilbe', false)
            }
        },
        _onFocus : function (e){
            var that = this;
            that.set('messageVisible', false);
            setTimeout(function () {//hack for chrome
                if (that._isSelectVal) {
                    return;
                }
                e.currentTarget.select();
            }, 100)
        },
        /**
         * 判断是否在区域外的点击
         * @param target_node
         * @param region_nodes
         * @returns {boolean}
         * @private
         */
        _isOutSide: function (target_node, region_nodes) {
            for (var i = 0 , len = region_nodes.length; i < len; i++) {
                var _region = region_nodes[i][0];
                if (target_node === _region || S.one(target_node).parent(function (el) {//触发click事件的srcElement不是region_nodes成员或者它的父级元素也没有region_nodes的成员时
                    //filter
                    if (el === _region) {
                        return true;
                    }
                })) {
                    return false;
                }

            }
            return true;
        },
        _afterDocClick : function (e) {
            var target = e.target;
            if (this._isOutSide(target, [this.overlayNode , this.inputNode].concat(this.get('trigger')))) {
                this.set('resultsListVisible', false);
                this.set('visible', false);
            }
        },
        _onSelect : function (e){
            var that = this,
                input_node = this.get('inputNode');
            this._updateValue(e.result.text);
            this._isSelectVal = true;//增加一个私有属性, 记录当前状态的改变是由select事件触发，并在200MS后释放状态
            setTimeout(function () {
                that._isSelectVal = false;
            }, 200);
            input_node[0].focus();
            this.set(ACTIVE_ITEM, null);
            this.set('resultsListVisible', false);
            this.set('visible', false);
        },
        _onQuery : function (e) {
            if (e.newVal.query.length === 0) {
                this.set('resultsListVisible', false);
                this.set('messageVisible', false);
            }
        },
        /**
         * 上下按钮选择时触发回调
         * @param e
         * @private
         */
        _afterActiveChange : function (e){
            var prev_item = e.prevVal;
            var new_item = e.newVal;
            prev_item && prev_item.removeClass(CLS_ACTIVE);
            new_item && new_item.addClass(CLS_ACTIVE);
        },
        /**
         * 鼠标移动到ITEM上时的回调
         * @param e
         * @private
         */
        _afterHoverChange : function (e){
            var prev_item = e.prevVal;
            var new_item = e.newVal;
            prev_item && prev_item.removeClass(CLS_HOVER);
            new_item && new_item.addClass(CLS_HOVER);
        },
        /**
         * 键盘事件回调
         * @param e
         * @private
         */
        _afterKeyDown : function (e){
            switch(e.keyCode){
                case 38 :
                    e.preventDefault();
                    this.activePrevItem();
                    break;
                case 40 :
                    e.preventDefault();
                    this.activeNextItem();
                    break;
                case 13 :
                    e.preventDefault();
                    this.get('resultsListVisible') && this.get(ACTIVE_ITEM) && this.selectItem();
                    break;
                case 9 :// tab
                    if (this.get('resultsListVisible') && this.get(ACTIVE_ITEM)) {
                        e.preventDefault();
                        this.selectItem();
                    }
                    this.set('resultsListVisible', false);
                    this.set('visible' , false);
                    break;
                case 27 :// esc
                    this.set('resultsListVisible', false);
                    this.set('visible' , false);
                    break;
                default :
                    break;
            }
        },
        /**
         * 鼠标移入时选中指定项
         * @param item
         */
        hoverItem : function (item){
            if (!item) {
                return ;
            }
            this.set(HOVER_ITEM , item);
        },
        /**
         * 通过键盘激活的下一项
         */
        activeNextItem : function (){
            var active_item = this.get(ACTIVE_ITEM);
            var next_item ;
            if(active_item){
                next_item = active_item.next(SELECTOR_ITEM);
                if (!next_item) {
                    next_item = this._getFirstItem();
                }
            }
            else{
                next_item = this._getFirstItem();
            }
            this.set(ACTIVE_ITEM , next_item);
        },
        /**
         * 通过键盘激活的上一项
         */
        activePrevItem : function (){
            var item = this.get(ACTIVE_ITEM);
            var prev_item =  item ? item.prev(SELECTOR_ITEM) || this._getLastItem() : this._getLastItem();
            this.set(ACTIVE_ITEM , prev_item);
        },
        /**
         * 返回节点的第一个子节点
         * @returns {*}
         * @private
         */
        _getFirstItem : function (){
            return this.resultsListNode.one(SELECTOR_ITEM);
        },
        /**
         * 返回节点的最后一个子节点
         * @returns {*}
         * @private
         */
        _getLastItem : function (){
            return this.resultsListNode.one(SELECTOR_ITEM+':last-child');
        },
        /**
         * 设定宽度值
         * @param val
         * @returns {*}
         * @private
         */
        _getWidth: function (val) {
            if (S.isNumber(val)) {
                return val;
            }
            if (val instanceof S.NodeList) {
                return val.outerWidth();
            }
            if (val === null) {
                return this.get('inputNode').outerWidth();
            }
        }
    };
    return AutoCompleteRich;
},{requires : ['node','event','overlay','sizzle']});
KISSY.add('gallery/autocomplete/1.0/hot',function (S, Node , Event , Io , Tpl){
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
/**
 * @fileoverview 自动完成组件
 * @author 舒克<shuke.cl@taobao.com>
 * @module autocomplete
 **/
KISSY.add('gallery/autocomplete/1.0/index',function (S, AcBase, AcRich , AcHot) {
    /**
     * 通用的自动完成组件
     * @class Autocomplete
     * @constructor
     * @extends Base
     */
    var _extend = function (name , base , extensions , px , sx){
        var Autocomplete = function (){
            Autocomplete.superclass.constructor.apply(this,arguments);
            this.initializer();
        };
        //将构造函数和析构函数存入数组，然后依次调用，避免覆盖
        var initializers = [];
        var destructors = [];

        var addition = function (){};
        addition.prototype  = px;
        S.mix(addition , sx ,undefined, undefined , true);//mix statics
        extensions.push(addition);
        S.extend(Autocomplete, base);//继承 base
        S.each(extensions , function (extClass){ //mix 原型和静态属性方法
            var ext_pro = extClass.prototype ;
            //构造函数的处理
            if (ext_pro && ext_pro.initializer) {
                initializers.push(ext_pro.initializer);
            }
            //析构函数的处理
            if (ext_pro && ext_pro.destructor) {
                destructors.push(ext_pro.destructor)
            }
            S.augment(Autocomplete, extClass);
            S.mix(Autocomplete, extClass , undefined , undefined ,true);
        });
        Autocomplete.prototype.initializer = function (){
            S.each(initializers , function (initializer){
                initializer.call(this);
            },this);
        };
        Autocomplete.prototype.destructor = function (){
            S.each(destructors , function (destructor){
                destructor.call(this);
            },this);
        };
        Autocomplete.NAME = name ;
        return Autocomplete;
    };
    return _extend('Autocomplete' , S.Base , [AcBase , AcRich, AcHot],{},{});
}, {requires:['./base' , './rich' , './hot' ,'./autocomplete.css']});




