import React, { Component } from 'react';
import { FlatList, ActivityIndicator, View } from 'react-native';
import Reservation from './reservation';
import PropTypes from 'prop-types';
import XDate from 'xdate';
import _ from 'underscore'
import dateutils from '../../dateutils';
import styleConstructor from './style';
import { parseDate } from '../../interface';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { EventEmitter } from 'events';

class ReservationList extends Component {
  static displayName = 'IGNORE';

  static propTypes = {
    // specify your item comparison function for increased performance
    rowHasChanged: PropTypes.func,
    // specify how each item should be rendered in agenda
    renderItem: PropTypes.func,
    // specify how each date should be rendered. day can be undefined if the item is not first in that day.
    renderDay: PropTypes.func,
    // specify how empty date content with no items should be rendered
    renderEmptyDate: PropTypes.func,
    // callback that gets called when day changes while scrolling agenda list
    onDayChange: PropTypes.func,
    // onScroll ListView event
    onScroll: PropTypes.func,
    // the list of items that have to be displayed in agenda. If you want to render item as empty date
    // the value of date key kas to be an empty array []. If there exists no value for date key it is
    // considered that the date in question is not yet loaded
    reservations: PropTypes.object,
    emitter: PropTypes.object,
    selectedDay: PropTypes.instanceOf(XDate),
    topDay: PropTypes.instanceOf(XDate),
    refreshControl: PropTypes.element,
    refreshing: PropTypes.bool,
    onRefresh: PropTypes.func,
    onScrollBeginDrag: PropTypes.func,
    onScrollEndDrag: PropTypes.func,
    onMomentumScrollBegin: PropTypes.func,
    onMomentumScrollEnd: PropTypes.func,
    /** Show items only for the selected day. Default = false */
    showOnlySelectedDayItems: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.style = styleConstructor(props.theme);

    this.state = {
      reservations: []
    };

    this.reset = false
    this.resumeToTop = false
    this.heights = [];
    this.selectedDay = this.props.selectedDay;
    this.scrollOver = true;
    this.scrollPosition = 0
    this.offset = 0
    this.refresh = false
    //this.emitter = props.emitter
  }

  UNSAFE_componentWillMount() {
    this.updateDataSource(this.getReservations(this.props).reservations);
    this.props.emitter.addListener('goToToday', this.goOnTop.bind(this));
  }

  componentWillUnmount() {
    this.props.emitter.removeAllListeners()
  }

  updateDataSource(reservations) {
    this.setState({
      reservations
    });
  }

  goOnTop() {
    this.resumeToTop = true
    this.setState({
      reservations: []
    }, () => {
      const today = XDate(new Date())
      this.props.onDayChange(today.clone())
      this.updateReservations(this.props);
    });
    // const iterator = parseDate(today.clone().getTime());
    // let reservations = [];
    // for (let i = 0; i < 90; i++) {
    //   const res = this.getReservationsForDay(iterator, this.props);
    //   if (res) {
    //     reservations = reservations.concat(res);
    //   }
    //   iterator.addDays(1);
    // }
    // this.updateDataSource(reservations);
    // setTimeout(() => {
    //   this.list && this.list.scrollToOffset({offset: 0, animated: true});
    // }, 500);
  }

  updateReservations(props) {
    const reservations = this.getReservations(props);
    if (this.list && !dateutils.sameDate(props.selectedDay, this.selectedDay)) {
      let scrollPosition = 0;
      for (let i = 0; i < reservations.scrollPosition; i++) {
        scrollPosition += this.heights[i] || 0;
      }
      this.scrollOver = false;
      this.list && this.list.scrollToOffset({ offset: scrollPosition, animated: true });
    } else if (this.resumeToTop || this.reset) {
      this.resumeToTop = false
      this.reset = false
      this.list && this.list.scrollToOffset({ offset: 0, animated: true });
    }
    this.selectedDay = props.selectedDay;
    this.updateDataSource(reservations.reservations);
  }

  UNSAFE_componentWillReceiveProps(props) {

    this.updateReservations(props);

    if (!dateutils.sameDate(props.topDay, this.props.topDay)) {
      this.reset = true
      this.setState({
        reservations: []
      }, () => {
        this.updateReservations(props);
      });
    } else {
      this.updateReservations(props);
    }
  }

  onScroll(event) {
    const yOffset = event.nativeEvent.contentOffset.y;
    this.props.onScroll(yOffset);
    let topRowOffset = 0;
    let topRow;
    // if (!yOffset){
    //   let h = 0;
    //   let scrollPosition = 0;
    //   const selectedDay = this.props.selectedDay.clone();
    //   const iterator = parseDate(this.props.selectedDay.clone().getTime()-3600*24*10*1000);
    //   let reservations = [];
    //   for (let i = 0; i < 10; i++) {
    //     const res = this.getReservationsForDay(iterator, this.props);
    //     if (res) {
    //       reservations = reservations.concat(res);
    //     }
    //     iterator.addDays(1);
    //   }
    //   scrollPosition = reservations.length;
    //   for (let i = 10; i < 30; i++) {
    //     const res = this.getReservationsForDay(iterator, this.props);
    //     if (res) {
    //       reservations = reservations.concat(res);
    //     }
    //     iterator.addDays(1);
    //   }
    //   this.setState({
    //     reservations
    //   }, () => {
    //       let h = 0;
    //       for (let i = 0; i < scrollPosition; i++) {
    //         h += ITEM_HEIGHT || 0;
    //       }
    //       this.list.scrollToOffset({offset: h, animated: false});
    //       this.props.onDayChange(selectedDay, false);
    //   });
    // }

    for (topRow = 0; topRow < this.heights.length; topRow++) {
      if (topRowOffset + this.heights[topRow] / 2 >= yOffset) {
        break;
      }
      topRowOffset += this.heights[topRow];
    }
    const row = this.state.reservations[topRow];
    if (!row) return;
    const day = row.day;
    const sameDate = dateutils.sameDate(day, this.selectedDay);
    if (!sameDate && this.scrollOver) {
      this.selectedDay = day.clone();
      this.props.onDayChange(day.clone());
    }
  }

  onRowLayoutChange(ind, event) {
    this.heights[ind] = event.nativeEvent.layout.height;
    if (ind < this.scrollPosition) {
      this.offset += event.nativeEvent.layout.height
    } else if (this.refresh) {
      this.refresh = false
      const selectedDay = this.props.selectedDay.clone();
      this.list.scrollToOffset({ offset: this.offset, animated: true });
      this.props.onDayChange(selectedDay, false);
      this.offset = 0
      this.scrollPosition = 0
    }
  }

  renderRow({ item, index }) {
    return (
      <View onLayout={this.onRowLayoutChange.bind(this, index)}>
        <Reservation
          item={item}
          renderItem={this.props.renderItem}
          renderDay={this.props.renderDay}
          renderEmptyDate={this.props.renderEmptyDate}
          theme={this.props.theme}
          rowHasChanged={this.props.rowHasChanged}
        />
      </View>
    );
  }

  getReservationsForDay(iterator, props) {
    const day = iterator.clone();
    const res = props.reservations[day.toString('yyyy-MM-dd')];
    if (res && res.length) {
      return res.map((reservation, i) => {
        return {
          reservation,
          date: i ? false : day,
          day
        };
      });
    } else if (res) {
      return [{
        date: iterator.clone(),
        day
      }];
    } else {
      return false;
    }
  }

  onListTouch() {
    this.scrollOver = true;
  }

  getReservations(props) {
    if (!props.reservations || !props.selectedDay) {
      return { reservations: [], scrollPosition: 0 };
    }
    let reservations = [];
    if (this.state.reservations && this.state.reservations.length) {
      const iterator = this.state.reservations[0].day.clone();
      while (iterator.getTime() < props.selectedDay.getTime()) {
        const res = this.getReservationsForDay(iterator, props);
        if (!res) {
          reservations = [];
          break;
        } else {
          reservations = reservations.concat(res);
        }
        iterator.addDays(1);
      }
    }
    const scrollPosition = reservations.length;
    const iterator = props.selectedDay.clone();
    if (this.props.showOnlySelectedDayItems) {
      const res = this.getReservationsForDay(iterator, props);
      if (res) {
        reservations = res;
      }
      iterator.addDays(1);
    } else {
      for (let i = 0; i < 30; i++) {
        const res = this.getReservationsForDay(iterator, props);
        if (res) {
          reservations = reservations.concat(res);
        }
        iterator.addDays(1);
      }
    }
    return { reservations, scrollPosition };
  }

  _onRefresh = () => {
    if (_.isFunction(this.props.onRefresh)) {
      this.props.onRefresh()
    }
    this.refresh = true
    let h = 0;
    let scrollPosition = 0;
    const selectedDay = this.props.selectedDay.clone();
    const iterator = parseDate(this.props.selectedDay.clone().getTime() - 3600 * 24 * 10 * 1000);
    let reservations = [];
    for (let i = 0; i < 10; i++) {
      const res = this.getReservationsForDay(iterator, this.props);
      if (res) {
        reservations = reservations.concat(res);
      }
      iterator.addDays(1);
    }
    scrollPosition = reservations.length;
    for (let i = 10; i < 30; i++) {
      const res = this.getReservationsForDay(iterator, this.props);
      if (res) {
        reservations = reservations.concat(res);
      }
      iterator.addDays(1);
    }
    this.setState({
      reservations
    }, () => {
      // this.scrollPosition = scrollPosition
      // this.list.scrollToOffset({offset: 0, animated: true});
      this.props.onDayChange(parseDate(this.props.selectedDay.clone().getTime() - 3600 * 24 * 10 * 1000), true);
      // setTimeout(() => {
      //   let h = 0;
      //   for (let i = 0; i < scrollPosition; i++) {
      //     h += this.heights[i] || 0;
      //   }
      //   this.list.scrollToOffset({offset: h, animated: true});
      //   this.props.onDayChange(selectedDay, false);
      // }, 250);
    });

  }

  render() {
    const { reservations } = this.props;
    if (!reservations || !reservations[this.props.selectedDay.toString('yyyy-MM-dd')]) {
      if (this.props.renderEmptyData) {
        return this.props.renderEmptyData();
      }
      return (
        <ActivityIndicator style={this.style.indicator} color={this.props.theme && this.props.theme.indicatorColor} />
      );
    }
    return (
      <>
        <FlatList
          ref={(c) => this.list = c}
          style={this.props.style}
          contentContainerStyle={this.style.content}
          renderItem={this.renderRow.bind(this)}
          data={this.state.reservations}
          onScroll={this.onScroll.bind(this)}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={200}
          onMoveShouldSetResponderCapture={() => { this.onListTouch(); return false; }}
          keyExtractor={(item, index) => String(index)}
          refreshControl={this.props.refreshControl}
          refreshing={this.props.refreshing || false}
          onRefresh={this._onRefresh}
          onScrollBeginDrag={this.props.onScrollBeginDrag}
          onScrollEndDrag={this.props.onScrollEndDrag}
          onMomentumScrollBegin={this.props.onMomentumScrollBegin}
          onMomentumScrollEnd={this.props.onMomentumScrollEnd}
        />
      </>
    );
  }
}

export default ReservationList;
