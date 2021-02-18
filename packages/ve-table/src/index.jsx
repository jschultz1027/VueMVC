import { cloneDeep } from "lodash";
import {
    initGroupColumns,
    clsName,
    getNotFixedTotalWidthByColumnKey
} from "./util";
import { getValByUnit, isFunction } from "../../src/utils/index.js";
import emitter from "../../src/mixins/emitter";
import { COMPS_NAME, EMIT_EVENTS, COMPS_CUSTOM_ATTRS } from "./util/constant";
import Colgroup from "./colgroup";
import Header from "./header";
import Body from "./body";
import Footer from "./footer";
import { KEY_CODES } from "../../src/utils/constant";
import { isEmptyValue } from "../../src/utils/index";
import clickoutside from "../../src/directives/clickoutside";
import { mutations } from "./util/store";
import VueDomResizeObserver from "../../src/comps/resize-observer";

// virtual scroll positions
let virtualScrollPositions = [
    /* {
    rowKey: 0, // 当前行数据索引
    top: 0, // 距离上一个项的高度
    bottom: 100, // 距离下一个项的高度
    height: 100 // 自身高度
  } */
];
export default {
    name: COMPS_NAME.VE_TABLE,
    directives: {
        "click-outside": clickoutside
    },
    mixins: [emitter],
    props: {
        tableData: {
            required: true,
            type: Array
        },
        footerData: {
            type: Array,
            default: function() {
                return [];
            }
        },
        columns: {
            type: Array,
            required: true
        },
        // row key field for row expand、row selection
        rowKeyFieldName: {
            type: String,
            default: null
        },
        // table scroll width
        scrollWidth: {
            type: [Number, String],
            default: null
        },
        // table max height
        maxHeight: {
            type: [Number, String],
            default: null
        },
        // fixed header
        fixedHeader: {
            type: Boolean,
            default: true
        },
        // fixed footer
        fixedFooter: {
            type: Boolean,
            default: true
        },
        // border around
        borderAround: {
            type: Boolean,
            default: true
        },
        // border horizontal
        borderX: {
            type: Boolean,
            default: true
        },
        // border vertical
        borderY: {
            type: Boolean,
            default: false
        },
        // event custom option
        eventCustomOption: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // cell style option
        cellStyleOption: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // cell span option
        cellSpanOption: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // row style option
        rowStyleOption: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // virual scroll
        virtualScrollOption: {
            type: Object,
            default: null
        },
        // sort option
        sortOption: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // expand row option
        expandOption: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // checkbox option
        checkboxOptipon: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // radio option
        radioOption: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // cell selection option
        cellSelectionOption: {
            type: Object,
            default: function() {
                return null;
            }
        },
        // edit opttion
        editOption: {
            type: Object,
            default: function() {
                return null;
            }
        }
    },
    data() {
        return {
            /*
            列配置变化次数
            依赖columns 配置渲染，都需要重新计算：粘性布局时，重新触发 on-dom-resize-change 事件
            */
            columnsOptionResetTime: 0,
            tableContainerRef: "tableContainerRef",
            tableContentRef: "tableContentRef",
            virtualPhantomRef: "virtualPhantomRef",
            cloneTableData: [],
            cloneColumns: [],
            // is group header
            isGroupHeader: false,
            /*
            header rows created by groupColumns
            */
            headerRows: [
                /* {
                rowHeight:40
            } */
            ],
            /*
            footer rows created by footerData
            */
            footerRows: [
                /* {
                rowHeight:40
             } */
            ],
            // colgroups
            colgroups: [],
            //  groupColumns
            groupColumns: [],
            // virtual scroll start index
            virtualScrollStartIndex: 0,
            // virtual scroll end index
            virtualScrollEndIndex: 0,
            // default virtual scroll buffer scale
            defaultVirtualScrollBufferScale: 1,
            // default virtual scroll min row height
            defaultVirtualScrollMinRowHeight: 42,
            // is scrolling left
            isLeftScrolling: false,
            // is scrolling right
            isRightScrolling: false,
            // cell selection key
            cellSelectionKeyData: {
                rowKey: "",
                columnKey: ""
            }
        };
    },

    computed: {
        // return row keys
        allRowKeys() {
            let result = [];

            const { cloneTableData, rowKeyFieldName } = this;

            if (rowKeyFieldName) {
                result = cloneTableData.map(x => {
                    return x[rowKeyFieldName];
                });
            }

            return result;
        },
        // virtual scroll visible count
        virtualScrollVisibleCount() {
            let result = 0;

            const {
                isVirtualScroll,
                virtualScrollOption,
                defaultVirtualScrollMinRowHeight
            } = this;

            if (isVirtualScroll && this.maxHeight) {
                const minRowHeight =
                    typeof virtualScrollOption.minRowHeight === "number"
                        ? virtualScrollOption.minRowHeight
                        : defaultVirtualScrollMinRowHeight;
                result = Math.ceil(this.maxHeight / minRowHeight);
            }
            return result;
        },
        // virtual scroll above count
        virtualScrollAboveCount() {
            let result = 0;
            const {
                isVirtualScroll,
                virtualScrollOption,
                virtualScrollStartIndex,
                virtualScrollVisibleCount,
                defaultVirtualScrollBufferScale
            } = this;
            if (isVirtualScroll) {
                const bufferScale =
                    typeof virtualScrollOption.bufferScale === "number"
                        ? virtualScrollOption.bufferScale
                        : defaultVirtualScrollBufferScale;

                result = Math.min(
                    virtualScrollStartIndex,
                    bufferScale * virtualScrollVisibleCount
                );
            }
            return result;
        },
        // virtual scroll bellow count
        virtualScrollBelowCount() {
            let result = 0;

            const {
                isVirtualScroll,
                virtualScrollOption,
                virtualScrollEndIndex,
                virtualScrollVisibleCount,
                cloneTableData,
                defaultVirtualScrollBufferScale
            } = this;
            if (isVirtualScroll) {
                const bufferScale =
                    typeof virtualScrollOption.bufferScale === "number"
                        ? virtualScrollOption.bufferScale
                        : defaultVirtualScrollBufferScale;

                result = Math.min(
                    cloneTableData.length - virtualScrollEndIndex,
                    bufferScale * virtualScrollVisibleCount
                );
            }

            return result;
        },
        // virtual scroll visible data
        virtualScrollVisibleData() {
            let result = [];

            const {
                isVirtualScroll,
                virtualScrollStartIndex: startIndex,
                virtualScrollEndIndex: endIndex,
                virtualScrollBelowCount: belowCount,
                virtualScrollAboveCount: aboveCount,
                cloneTableData
            } = this;
            if (isVirtualScroll) {
                let start = startIndex - aboveCount;
                let end = endIndex + belowCount;

                result = cloneTableData.slice(start, end);
            }

            return result;
        },
        // table container style
        tableContainerStyle() {
            let maxHeight = getValByUnit(this.maxHeight);

            let virtualScrollHeight = null;
            if (this.isVirtualScroll) {
                if (maxHeight) {
                    virtualScrollHeight = maxHeight;
                } else {
                    console.error(
                        "maxHeight prop is required when 'virtualScrollOption.enable = true'"
                    );
                }
            }

            return {
                "max-height": maxHeight,
                // if virtual scroll
                height: virtualScrollHeight
            };
        },
        // table style
        tableStyle() {
            return {
                width: getValByUnit(this.scrollWidth)
            };
        },
        // table class
        tableClass() {
            return {
                [clsName("border-x")]: this.borderX,
                [clsName("border-y")]: this.borderY
            };
        },
        // table container class
        tableContainerClass() {
            const {
                borderAround,
                isVirtualScroll,
                isLeftScrolling,
                isRightScrolling
            } = this;

            return {
                [clsName("container")]: true,
                [clsName("border-around")]: borderAround,
                [clsName("virtual-scroll")]: isVirtualScroll,
                [clsName("container-left-scrolling")]: isLeftScrolling,
                [clsName("container-right-scrolling")]: isRightScrolling
            };
        },
        // table body class
        tableBodyClass() {
            let result = null;

            const { rowStyleOption } = this;

            let hoverHighlight = true;
            let clickHighlight = true;
            let stripe = false;

            if (rowStyleOption) {
                hoverHighlight = rowStyleOption.hoverHighlight;
                clickHighlight = rowStyleOption.clickHighlight;
                stripe = rowStyleOption.stripe;
            }

            result = {
                [clsName("stripe")]: stripe === true, // 默认不开启
                [clsName("row-hover")]: hoverHighlight !== false, // 默认开启
                [clsName("row-highlight")]: clickHighlight !== false // 默认开启
            };

            return result;
        },
        // is virtual scroll
        isVirtualScroll() {
            const { virtualScrollOption } = this;
            return virtualScrollOption && virtualScrollOption.enable;
        },
        // has fixed column
        hasFixedColumn() {
            return this.colgroups.some(
                x => x.fixed === "left" || x.fixed === "right"
            );
        },
        // is last left fixed column
        hasLeftFixedColumn() {
            return this.colgroups.some(x => x.fixed === "left");
        }
    },
    watch: {
        tableData: {
            handler() {
                this.initTableData();
            },
            immediate: true
        },
        columns: {
            handler(newVal, oldVal) {
                if (newVal != oldVal) {
                    this.columnsOptionResetTime++;
                }
                this.initColumns();
                this.initGroupColumns();
            },
            immediate: true
        },
        // group columns change watch
        groupColumns: {
            handler(val) {
                if (Array.isArray(val) && val.length > 0) {
                    this.initHeaderRows();
                }
            },
            immediate: true
        },
        // footerData
        footerData: {
            handler(val) {
                if (Array.isArray(val) && val.length > 0) {
                    this.initFooterRows();
                }
            },
            immediate: true
        },
        // watch clone table data
        cloneTableData: {
            handler() {
                this.initVirtualScrollPositions();
            },
            immediate: true
        }
    },

    methods: {
        // int header rows
        initHeaderRows() {
            const { groupColumns } = this;

            if (Array.isArray(groupColumns)) {
                this.headerRows = groupColumns.map(x => {
                    return { rowHeight: 0 };
                });
            }
        },

        // int header rows
        initFooterRows() {
            const { footerData } = this;

            if (Array.isArray(footerData)) {
                this.footerRows = footerData.map(x => {
                    return { rowHeight: 0 };
                });
            }
        },

        // header tr height resize
        headerTrHeightChange({ rowIndex, height }) {
            this.headerRows.splice(rowIndex, 1, { rowHeight: height });
        },

        // footer tr height resize
        footTrHeightChange({ rowIndex, height }) {
            this.footerRows.splice(rowIndex, 1, { rowHeight: height });
        },

        // td width change
        tdWidthChange(colWidths) {
            this.colgroups = this.colgroups.map(item => {
                // map
                item._realTimeWidth = colWidths.get(item.key);
                return item;
            });
        },

        /*
        init table data
        暂时不需要克隆，预留的功能
        */
        initTableData() {
            // this.cloneTableData = cloneDeep(this.tableData);
            this.cloneTableData = this.tableData;
        },
        // init columns
        initColumns() {
            this.cloneColumns = cloneDeep(this.columns);
        },

        // 初始化分组表头
        initGroupColumns() {
            const result = initGroupColumns(this.cloneColumns);

            // set is group header
            this.isGroupHeader = result.isGroupHeader;
            // set colgroups
            this.colgroups = result.colgroups;
            // set groupColumns
            this.groupColumns = result.groupColumns;
        },

        /*
         * @selectedAllChange
         * @desc  selected all change
         * @param {bool} isSelected - is selected
         */
        selectedAllChange({ isSelected }) {
            this.broadcast(
                COMPS_NAME.VE_TABLE_BODY,
                EMIT_EVENTS.CHECKBOX_SELECTED_ALL_CHANGE,
                {
                    isSelected
                }
            );
        },

        /*
         * @setSelectedAllInfo
         * @desc  set selected all info
         * @param {bool} isSelected - is selected
         * @param {bool} isIndeterminate - is indeterminate
         */
        setSelectedAllInfo({ isSelected, isIndeterminate }) {
            this.broadcast(
                COMPS_NAME.VE_TABLE_HEADER_CHECKBOX_CONTENT,
                EMIT_EVENTS.CHECKBOX_SELECTED_ALL_INFO,
                {
                    isSelected,
                    isIndeterminate
                }
            );
        },

        // cell selection key change
        cellSelectionKeyChange(data) {
            this.cellSelectionKeyData = data;
        },

        // deal keydown event
        dealKeydownEvent(event) {
            // cell direction
            this.cellDirection(event);
        },
        // cell direction
        cellDirection(event) {
            const {
                cellSelectionKeyData,
                colgroups,
                allRowKeys,
                rowKeyFieldName
            } = this;

            const { keyCode } = event;

            const { rowKey, columnKey } = cellSelectionKeyData;

            if (!isEmptyValue(rowKey) && !isEmptyValue(columnKey)) {
                let columnIndex = colgroups.findIndex(x => x.key === columnKey);
                let rowIndex = allRowKeys.indexOf(rowKey);
                if (keyCode === KEY_CODES.ARROW_LEFT) {
                    event.preventDefault();
                    if (columnIndex > 0) {
                        const nextColumn = colgroups[columnIndex - 1];
                        this.cellSelectionKeyData.columnKey = nextColumn.key;
                        this.columnToVisible(KEY_CODES.ARROW_LEFT, nextColumn);
                    }
                } else if (keyCode === KEY_CODES.ARROW_RIGHT) {
                    event.preventDefault();
                    if (columnIndex < colgroups.length - 1) {
                        const nextColumn = colgroups[columnIndex + 1];
                        this.cellSelectionKeyData.columnKey = nextColumn.key;
                        this.columnToVisible(KEY_CODES.ARROW_RIGHT, nextColumn);
                    }
                } else if (keyCode === KEY_CODES.ARROW_UP) {
                    event.preventDefault();
                    if (rowIndex > 0) {
                        const nextRowKey = allRowKeys[rowIndex - 1];
                        this.cellSelectionKeyData.rowKey = nextRowKey;

                        this.rowToVisible(KEY_CODES.ARROW_UP, nextRowKey);
                    }
                } else if (keyCode === KEY_CODES.ARROW_DOWN) {
                    event.preventDefault();

                    if (rowIndex < allRowKeys.length - 1) {
                        const nextRowKey = allRowKeys[rowIndex + 1];
                        this.cellSelectionKeyData.rowKey = nextRowKey;

                        this.rowToVisible(KEY_CODES.ARROW_DOWN, nextRowKey);
                    }
                }
            }
        },

        /*
         * @columnToVisible
         * @desc  column to visible
         * @param {number} keyCode - current keyCode
         * @param {object} nextColumn - next column
         */
        columnToVisible(keyCode, nextColumn) {
            const { colgroups } = this;

            const tableContainerRef = this.$refs[this.tableContainerRef];

            const { scrollWidth, clientWidth, scrollLeft } = tableContainerRef;

            // arrow left
            if (keyCode === KEY_CODES.ARROW_LEFT) {
                // 不是固定列
                if (scrollLeft && !nextColumn.fixed) {
                    const totalWidth = getNotFixedTotalWidthByColumnKey({
                        colgroups,
                        columnKey: nextColumn.key,
                        direction: "left"
                    });
                    const diff = scrollLeft - totalWidth;
                    if (diff > 0) {
                        tableContainerRef.scrollLeft = scrollLeft - diff;
                    }
                }
            }
            // arrow right
            else if (keyCode === KEY_CODES.ARROW_RIGHT) {
                const scrollRight = scrollWidth - clientWidth - scrollLeft;

                // 不是固定列
                if (scrollRight && !nextColumn.fixed) {
                    const totalWidth = getNotFixedTotalWidthByColumnKey({
                        colgroups,
                        columnKey: nextColumn.key,
                        direction: "right"
                    });
                    const diff = scrollRight - totalWidth;
                    if (diff > 0) {
                        tableContainerRef.scrollLeft = scrollLeft + diff;
                    }
                }
            }
        },

        /*
         * @rowToVisible
         * @desc  row to visible 上下键暂不支持 虚拟滚动
         * @param {number} keyCode - current keyCode
         * @param {any} nextRowKey - next row key
         */
        rowToVisible(keyCode, nextRowKey) {
            const tableContainerRef = this.$refs[this.tableContainerRef];

            const { isVirtualScroll, headerRows, footerRows } = this;

            const {
                clientHeight: containerClientHeight,
                scrollTop: containerScrollTop
            } = tableContainerRef;

            const nextRowEl = this.$el.querySelector(
                `tbody tr[${COMPS_CUSTOM_ATTRS.BODY_ROW_KEY}="${nextRowKey}"]`
            );

            if (nextRowEl) {
                const {
                    offsetTop: trOffsetTop,
                    clientHeight: trClientHeight
                } = nextRowEl;

                // arrow up
                if (keyCode === KEY_CODES.ARROW_UP) {
                    const totalHeaderHeight = headerRows.reduce(
                        (total, currentVal) => {
                            return currentVal.rowHeight + total;
                        },
                        0
                    );

                    let diff = 0;
                    if (isVirtualScroll) {
                        const parentOffsetTop =
                            nextRowEl.offsetParent.offsetTop;

                        diff =
                            totalHeaderHeight -
                            (trOffsetTop -
                                (containerScrollTop - parentOffsetTop));
                    } else {
                        diff =
                            containerScrollTop +
                            totalHeaderHeight -
                            trOffsetTop;
                    }

                    if (diff > 0) {
                        tableContainerRef.scrollTop = containerScrollTop - diff;
                    }
                }
                // arrow down
                else if (keyCode === KEY_CODES.ARROW_DOWN) {
                    const totalFooterHeight = footerRows.reduce(
                        (total, currentVal) => {
                            return currentVal.rowHeight + total;
                        },
                        0
                    );

                    let diff = 0;
                    if (isVirtualScroll) {
                        const parentOffsetTop =
                            nextRowEl.offsetParent.offsetTop;

                        diff =
                            trOffsetTop -
                            (containerScrollTop - parentOffsetTop) +
                            trClientHeight +
                            totalFooterHeight -
                            containerClientHeight;
                    } else {
                        diff =
                            trOffsetTop +
                            trClientHeight +
                            totalFooterHeight -
                            (containerClientHeight + containerScrollTop);
                    }

                    if (diff >= 0) {
                        tableContainerRef.scrollTop = containerScrollTop + diff;
                    }
                }
            }
        },

        // get virtual phantom
        getVirtualViewPhantom() {
            let content = null;

            /*
            1、is virtualScroll
            or
            2、
            has left fixed column and expand option（resolve expand row content sticky）
            */
            const { isVirtualScroll, hasLeftFixedColumn, expandOption } = this;

            if (isVirtualScroll || (hasLeftFixedColumn && expandOption)) {
                const props = {
                    props: {
                        tagName: "div"
                    },
                    style: {
                        width: "100%"
                    },
                    on: {
                        "on-dom-resize-change": ({ width }) => {
                            mutations.setStore({
                                tableViewportWidth: width
                            });
                        }
                    }
                };

                content = (
                    <div
                        ref={this.virtualPhantomRef}
                        class={[
                            clsName("virtual-phantom"),
                            isVirtualScroll ? clsName("virtual-scroll") : ""
                        ]}
                    >
                        <VueDomResizeObserver {...props} />
                    </div>
                );
            }

            return content;
        },

        // init virtual scroll positions
        initVirtualScrollPositions() {
            if (this.isVirtualScroll) {
                const {
                    virtualScrollOption,
                    rowKeyFieldName,
                    cloneTableData,
                    defaultVirtualScrollMinRowHeight
                } = this;

                const minRowHeight =
                    typeof virtualScrollOption.minRowHeight === "number"
                        ? virtualScrollOption.minRowHeight
                        : defaultVirtualScrollMinRowHeight;

                virtualScrollPositions = cloneTableData.map((item, index) => ({
                    rowKey: item[rowKeyFieldName],
                    height: minRowHeight,
                    top: index * minRowHeight,
                    bottom: (index + 1) * minRowHeight
                }));
            }
        },
        // list item height change
        bodyTrHeightChange({ rowKey, height }) {
            const positions = virtualScrollPositions;

            //获取真实元素大小，修改对应的尺寸缓存
            const index = positions.findIndex(x => x.rowKey === rowKey);

            let oldHeight = positions[index].height;
            let dValue = oldHeight - height;
            //存在差值
            if (dValue) {
                positions[index].bottom = positions[index].bottom - dValue;
                positions[index].height = height;
                for (let k = index + 1; k < positions.length; k++) {
                    positions[k].top = positions[k - 1].bottom;
                    positions[k].bottom = positions[k].bottom - dValue;
                }

                //更新列表总高度
                let totalHeight = positions[positions.length - 1].bottom;
                this.$refs[this.virtualPhantomRef].style.height =
                    totalHeight + "px";

                //更新真实偏移量
                this.setVirtualScrollStartOffset();
            }
        },
        // set virtual scroll start offset
        setVirtualScrollStartOffset() {
            const {
                virtualScrollStartIndex: start,
                virtualScrollAboveCount: aboveCount
            } = this;

            const positions = virtualScrollPositions;

            let startOffset;
            if (start >= 1) {
                let size =
                    positions[start].top -
                    (positions[start - aboveCount]
                        ? positions[start - aboveCount].top
                        : 0);
                startOffset = positions[start - 1].bottom - size;
            } else {
                startOffset = 0;
            }

            //this.$refs[this.tableContentRef].style.transform = `translate3d(0,${startOffset}px,0)`;
            this.$refs[this.tableContentRef].style.top = `${startOffset}px`;
        },
        // get virtual scroll start index
        getVirtualScrollStartIndex(scrollTop = 0) {
            return this.virtualScrollBinarySearch(
                virtualScrollPositions,
                scrollTop
            );
        },
        // virtual scroll binary search
        virtualScrollBinarySearch(list, value) {
            let start = 0;
            let end = list.length - 1;
            let tempIndex = null;

            while (start <= end) {
                let midIndex = parseInt((start + end) / 2);
                let midValue = list[midIndex].bottom;
                if (midValue === value) {
                    return midIndex + 1;
                } else if (midValue < value) {
                    start = midIndex + 1;
                } else if (midValue > value) {
                    if (tempIndex === null || tempIndex > midIndex) {
                        tempIndex = midIndex;
                    }
                    end = end - 1;
                }
            }
            return tempIndex;
        },
        // virtual scroll handler
        tableContainerScrollHandler() {
            const tableContainerRef = this.$refs[this.tableContainerRef];

            this.setScrolling();

            if (this.isVirtualScroll) {
                const {
                    virtualScrollVisibleCount: visibleCount,
                    virtualScrollOption,
                    virtualScrollAboveCount: visibleAboveCount,
                    virtualScrollBelowCount: visibleBelowCount
                } = this;

                //当前滚动位置
                let scrollTop = tableContainerRef.scrollTop;

                //此时的开始索引
                let visibleStartIndex = this.getVirtualScrollStartIndex(
                    scrollTop
                );
                this.virtualScrollStartIndex = visibleStartIndex;

                //此时的结束索引
                let visibleEndIndex =
                    this.virtualScrollStartIndex + visibleCount;
                this.virtualScrollEndIndex = visibleEndIndex;

                //此时的偏移量
                this.setVirtualScrollStartOffset();

                const { scrolling } = virtualScrollOption;
                if (isFunction(scrolling)) {
                    let scrollStartIndex =
                        visibleStartIndex - visibleAboveCount;

                    scrolling({
                        scrollStartIndex:
                            scrollStartIndex > 0 ? scrollStartIndex : 0,
                        visibleStartIndex,
                        visibleEndIndex,
                        visibleAboveCount,
                        visibleBelowCount
                    });
                }
            }
        },
        // init virtual scroll
        initVirtualScroll() {
            if (this.isVirtualScroll) {
                this.virtualScrollStartIndex = 0;
                this.virtualScrollEndIndex =
                    this.virtualScrollStartIndex +
                    this.virtualScrollVisibleCount;
            }
        },

        // set scrolling
        setScrolling() {
            const tableContainerRef = this.$refs[this.tableContainerRef];

            const { scrollWidth, clientWidth, scrollLeft } = tableContainerRef;

            this.isLeftScrolling = scrollLeft > 0;
            this.isRightScrolling = scrollWidth - clientWidth > scrollLeft;
        },

        // init scrolling
        initScrolling() {
            if (this.hasFixedColumn) {
                this.setScrolling();
            }
        },

        // table blur
        tableBlur() {
            // reset cell selection key data
            this.cellSelectionKeyData = {
                rowKey: "",
                columnKey: ""
            };
        }
    },
    mounted() {
        // receive row selected change
        this.$on(EMIT_EVENTS.CHECKBOX_SELECTED_ALL_CHANGE, params => {
            this.selectedAllChange(params);
        });

        // receive selected all info
        this.$on(EMIT_EVENTS.CHECKBOX_SELECTED_ALL_INFO, params => {
            this.setSelectedAllInfo(params);
        });

        // receive multiple header row height change
        this.$on(
            EMIT_EVENTS.HEADER_TR_HEIGHT_CHANGE,
            ({ rowIndex, height }) => {
                this.headerTrHeightChange({ rowIndex, height });
            }
        );

        // receive virtual scroll row height change
        this.$on(EMIT_EVENTS.BODY_TR_HEIGHT_CHANGE, ({ rowKey, height }) => {
            this.bodyTrHeightChange({ rowKey, height });
        });

        // receive footer row height change
        this.$on(
            EMIT_EVENTS.Footer_TR_HEIGHT_CHANGE,
            ({ rowIndex, height }) => {
                this.footTrHeightChange({ rowIndex, height });
            }
        );

        // add key down event listener
        document.addEventListener("keydown", this.dealKeydownEvent);

        // init virtual scroll
        this.initVirtualScroll();

        // init scrolling
        this.initScrolling();
    },
    destroyed() {
        // remove key down event listener
        document.removeEventListener("keydown", this.dealKeydownEvent);
    },
    render() {
        const {
            tableContainerStyle,
            tableStyle,
            tableClass,
            colgroups,
            groupColumns,
            fixedHeader,
            fixedFooter,
            cloneTableData,
            tdWidthChange,
            expandOption,
            checkboxOptipon,
            radioOption,
            rowKeyFieldName,
            virtualScrollOption,
            isVirtualScroll,
            virtualScrollVisibleData,
            sortOption,
            cellStyleOption
        } = this;

        // header props
        const headerProps = {
            class: clsName("header"),
            props: {
                columnsOptionResetTime: this.columnsOptionResetTime,
                groupColumns,
                colgroups,
                fixedHeader,
                checkboxOptipon,
                sortOption,
                cellStyleOption,
                eventCustomOption: this.eventCustomOption,
                headerRows: this.headerRows
            }
        };

        // body props
        const bodyProps = {
            class: [clsName("body"), this.tableBodyClass],
            props: {
                columnsOptionResetTime: this.columnsOptionResetTime,
                colgroups,
                expandOption,
                checkboxOptipon,
                cloneTableData,
                rowKeyFieldName,
                radioOption,
                virtualScrollOption,
                isVirtualScroll,
                virtualScrollVisibleData,
                cellStyleOption,
                cellSpanOption: this.cellSpanOption,
                eventCustomOption: this.eventCustomOption,
                cellSelectionOption: this.cellSelectionOption,
                hasFixedColumn: this.hasFixedColumn,
                cellSelectionKeyData: this.cellSelectionKeyData,
                allRowKeys: this.allRowKeys,
                editOption: this.editOption
            },
            on: {
                [EMIT_EVENTS.BODY_TD_WIDTH_CHANGE]: tdWidthChange,
                [EMIT_EVENTS.CELL_SELECTION_KEY_CHANGE]: this
                    .cellSelectionKeyChange
            }
        };

        // footer props
        const footerProps = {
            class: [clsName("footer")],
            props: {
                colgroups,
                footerData: this.footerData,
                rowKeyFieldName,
                cellStyleOption,
                fixedFooter,
                cellSpanOption: this.cellSpanOption,
                eventCustomOption: this.eventCustomOption,
                hasFixedColumn: this.hasFixedColumn,
                allRowKeys: this.allRowKeys,
                footerRows: this.footerRows
            }
        };

        // container props
        const containerProps = {
            ref: this.tableContainerRef,
            class: this.tableContainerClass,
            style: tableContainerStyle,
            on: {
                scroll: this.tableContainerScrollHandler
            },
            directives: [
                {
                    name: "click-outside",
                    value: this.tableBlur
                }
            ]
        };

        return (
            <div class="ve-table">
                <div {...containerProps}>
                    {/* virtual view phantom */}
                    {this.getVirtualViewPhantom()}
                    <table
                        ref={this.tableContentRef}
                        style={tableStyle}
                        class={[clsName("content"), tableClass]}
                    >
                        {/* colgroup */}
                        <Colgroup colgroups={colgroups} />
                        {/* table header */}
                        <Header {...headerProps} />
                        {/* table body */}
                        <Body {...bodyProps} />
                        {/* table footer */}
                        <Footer {...footerProps} />
                    </table>
                </div>
            </div>
        );
    }
};
